const { query } = require('../config/db');
const { encrypt, decrypt } = require('../config/encryption');
const whatsappService = require('../services/whatsappService');

const getLeads = async (req, res) => {
    try {
        const statusFilter = req.query.status || 'ALL';
        const brandFilter = req.query.brand || 'ALL';
        const vendedorFilter = req.query.vendedor || 'ALL';
        const vendedorStatusFilter = req.query.vendedor_status || 'ALL';
        const tagFilter = req.query.tag || 'ALL';
        const searchVal = req.query.search || '';
        const startDate = req.query.start_date || '';
        const endDate = req.query.end_date || '';

        let sql = `
            SELECT 
                l.id, l.nombre, l.telefono, l.cedula_encriptada, l.ultimo_mensaje, 
                l.step_estado, l.ultimo_emisor, l.fecha_actualizacion, l.estado_atencion, 
                l.cuenta, l.tags, l.vendedor_id, l.estado_vendedor, u.username AS vendedor_nombre 
            FROM leads l
            LEFT JOIN users u ON l.vendedor_id = u.id
        `;
        let params = [];
        let whereClauses = [];

        // 1. Filtro por Estado de Atención
        if (statusFilter === 'URGENTE') {
            whereClauses.push("l.estado_atencion != 'RESUELTO' AND l.ultimo_emisor = 'CLIENTE' AND l.fecha_actualizacion <= NOW() - INTERVAL '30 minutes'");
        } else if (statusFilter === 'SEGUIMIENTO') {
            whereClauses.push("l.estado_atencion != 'RESUELTO' AND l.ultimo_emisor = 'BOT' AND l.fecha_actualizacion <= NOW() - INTERVAL '2 hours'");
        } else if (statusFilter === 'NO_LEIDOS' || statusFilter === 'SIN_HUMANO') {
            whereClauses.push("l.estado_atencion != 'RESUELTO' AND l.ultimo_emisor != 'HUMANO' AND NOT EXISTS (SELECT 1 FROM mensajes m WHERE m.lead_id = l.id AND m.emisor = 'HUMANO')");
        } else if (statusFilter !== 'ALL') {
            params.push(statusFilter);
            whereClauses.push(`l.estado_atencion = $${params.length}`);
        }

        // 2. Filtro por Marca / Cuenta
        if (brandFilter !== 'ALL') {
            params.push(brandFilter);
            if (brandFilter === 'principal') {
                whereClauses.push(`(l.cuenta = $${params.length} OR l.cuenta IS NULL)`);
            } else {
                whereClauses.push(`l.cuenta = $${params.length}`);
            }
        }

        // 3. Filtro por Vendedor
        if (vendedorFilter === 'UNASSIGNED') {
            whereClauses.push('l.vendedor_id IS NULL');
        } else if (vendedorFilter === 'ME') {
            params.push(req.session.userId);
            whereClauses.push(`l.vendedor_id = $${params.length}`);
        } else {
            const parsedVendedorId = parseInt(vendedorFilter, 10);
            if (vendedorFilter && vendedorFilter !== 'ALL' && vendedorFilter.trim() !== '' && !isNaN(parsedVendedorId)) {
                params.push(parsedVendedorId);
                whereClauses.push(`l.vendedor_id = $${params.length}`);
            }
        }

        // 4. Filtro por Estatus Vendedor
        if (vendedorStatusFilter && vendedorStatusFilter !== 'ALL' && vendedorStatusFilter.trim() !== '') {
            params.push(vendedorStatusFilter);
            whereClauses.push(`l.estado_vendedor = $${params.length}`);
        }

        // 5. Filtro por Tag específico
        if (tagFilter && tagFilter !== 'ALL' && tagFilter.trim() !== '') {
            params.push(`%${tagFilter.trim()}%`);
            whereClauses.push(`l.tags ILIKE $${params.length}`);
        }

        // 6. Buscador por texto (nombre, teléfono, tags)
        if (searchVal && searchVal.trim() !== '') {
            params.push(`%${searchVal.trim()}%`);
            const pIndex = params.length;
            whereClauses.push(`(l.nombre ILIKE $${pIndex} OR l.telefono ILIKE $${pIndex} OR l.tags ILIKE $${pIndex})`);
        }

        // 7. Rango de Fechas
        if (startDate && startDate.trim() !== '') {
            params.push(`${startDate.trim()} 00:00:00`);
            whereClauses.push(`l.fecha_actualizacion >= $${params.length}`);
        }
        if (endDate && endDate.trim() !== '') {
            params.push(`${endDate.trim()} 23:59:59`);
            whereClauses.push(`l.fecha_actualizacion <= $${params.length}`);
        }

        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }

        sql += ' ORDER BY l.fecha_actualizacion DESC';

        const [rows] = await query(sql, params);

        const leads = rows.map(lead => ({
            ...lead,
            cedula_desencriptada: decrypt(lead.cedula_encriptada)
        }));

        res.json({ success: true, data: leads });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};

const updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_atencion } = req.body;

        if (!['PENDIENTE', 'EN_CURSO', 'RESUELTO'].includes(estado_atencion)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await query('UPDATE leads SET estado_atencion = $1 WHERE id = $2', [estado_atencion, id]);
        res.json({ success: true, message: 'Lead status updated' });
    } catch (error) {
        console.error('Error updating lead status:', error);
        res.status(500).json({ error: 'Failed to update lead status' });
    }
};

const sendManualMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { mensaje } = req.body;

        const [rows] = await query('SELECT telefono, cuenta FROM leads WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
        const { telefono, cuenta } = rows[0];
        const accountId = cuenta || 'principal';

        try {
            await whatsappService.sendMessage(accountId, telefono, mensaje);
            
            await query(
                'UPDATE leads SET ultimo_emisor = $1, ultimo_mensaje = $2, estado_atencion = $3, step_estado = 99, fecha_actualizacion = NOW() WHERE id = $4',
                ['HUMANO', mensaje, 'EN_CURSO', id]
            );

            // Guardar el mensaje en el historial y emitir por sockets
            const { saveMessage } = require('./botController');
            await saveMessage(id, 'HUMANO', mensaje, accountId, 'text');

            res.json({ success: true, message: 'Message sent successfully' });
        } catch (waError) {
            console.error('Error in WhatsApp service:', waError);
            res.status(400).json({ error: 'Failed to send message via WhatsApp', details: waError.message });
        }
    } catch (error) {
        console.error('Error sending manual message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

const updateLeadDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_atencion, step_estado, tags, vendedor_id, estado_vendedor } = req.body;

        let targetVendedorId = vendedor_id;
        if (vendedor_id === 'UNASSIGNED' || vendedor_id === '' || vendedor_id === null) {
            targetVendedorId = null;
        }

        await query(
            'UPDATE leads SET estado_atencion = $1, step_estado = $2, tags = $3, vendedor_id = $4, estado_vendedor = $5, fecha_actualizacion = NOW() WHERE id = $6',
            [estado_atencion, step_estado, tags, targetVendedorId, estado_vendedor || 'NINGUNO', id]
        );
        res.json({ success: true, message: 'Lead details updated successfully' });
    } catch (error) {
        console.error('Error updating lead details:', error);
        res.status(500).json({ error: 'Failed to update lead details' });
    }
};

const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM leads WHERE id = $1', [id]);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
};

const getBotFlow = async (req, res) => {
    try {
        const [rows] = await query("SELECT value FROM bot_settings WHERE key = 'flow_config'");
        if (rows.length === 0) return res.status(404).json({ error: 'Config not found' });
        res.json({ success: true, data: rows[0].value });
    } catch (error) {
        console.error('Error fetching bot flow:', error);
        res.status(500).json({ error: 'Failed to fetch bot flow' });
    }
};

const updateBotFlow = async (req, res) => {
    try {
        const { config } = req.body;
        if (!config) return res.status(400).json({ error: 'Missing config object' });

        await query("UPDATE bot_settings SET value = $1 WHERE key = 'flow_config'", [JSON.stringify(config)]);
        res.json({ success: true, message: 'Bot flow updated successfully' });
    } catch (error) {
        console.error('Error updating bot flow:', error);
        res.status(500).json({ error: 'Failed to update bot flow' });
    }
};

const assignLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendedor_id } = req.body; // Can be null, 'ME', 'UNASSIGNED', or a user ID

        let targetVendedorId = vendedor_id;
        if (vendedor_id === 'ME') {
            targetVendedorId = req.session.userId;
        } else if (vendedor_id === 'UNASSIGNED' || vendedor_id === '' || vendedor_id === null) {
            targetVendedorId = null;
        }

        await query('UPDATE leads SET vendedor_id = $1, fecha_actualizacion = NOW() WHERE id = $2', [targetVendedorId, id]);
        res.json({ success: true, message: 'Lead assigned successfully' });
    } catch (error) {
        console.error('Error assigning lead:', error);
        res.status(500).json({ error: 'Failed to assign lead' });
    }
};

const updateVendedorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_vendedor } = req.body;

        const validStatuses = ['NINGUNO', 'EN_SEGUIMIENTO', 'CITA_AGENDADA', 'ATENDIDO', 'DESCARTADO'];
        if (!validStatuses.includes(estado_vendedor)) {
            return res.status(400).json({ error: 'Invalid seller status' });
        }

        await query('UPDATE leads SET estado_vendedor = $1, fecha_actualizacion = NOW() WHERE id = $2', [estado_vendedor, id]);
        res.json({ success: true, message: 'Seller status updated successfully' });
    } catch (error) {
        console.error('Error updating seller status:', error);
        res.status(500).json({ error: 'Failed to update seller status' });
    }
};

const getLeadMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await query(
            'SELECT emisor, texto, tipo, cuenta, fecha FROM mensajes WHERE lead_id = $1 ORDER BY fecha ASC',
            [id]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching lead messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// KPIs Mensuales de Negocio (CAC, ROAS, Meta 30 Créditos)
const getMonthlyKpis = async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = String(now.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${monthNum}`;
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthName = `${monthNames[now.getMonth()]} ${year}`;

        // 1. Obtener configuración mensual de bot_settings
        let storedKpis = {};
        try {
            const [rows] = await query("SELECT value FROM bot_settings WHERE key = 'monthly_business_kpis'");
            if (rows.length > 0 && rows[0].value) {
                storedKpis = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
            }
        } catch (e) {}

        const currentMonthData = storedKpis[monthKey] || {};

        const cac = currentMonthData.cac !== undefined && currentMonthData.cac !== null ? Number(currentMonthData.cac) : 0;
        const roas = currentMonthData.roas !== undefined && currentMonthData.roas !== null ? Number(currentMonthData.roas) : 0;
        const targetCredits = currentMonthData.target_credits !== undefined && currentMonthData.target_credits !== null ? Number(currentMonthData.target_credits) : 30;
        const manualCredits = currentMonthData.manual_credits !== undefined && currentMonthData.manual_credits !== null ? Number(currentMonthData.manual_credits) : 0;
        const revenueInterior = currentMonthData.revenue_interior !== undefined && currentMonthData.revenue_interior !== null ? Number(currentMonthData.revenue_interior) : 0;
        const revenueCiudad = currentMonthData.revenue_ciudad !== undefined && currentMonthData.revenue_ciudad !== null ? Number(currentMonthData.revenue_ciudad) : 0;

        // 2. Calcular créditos/ventas reales del mes desde leads
        let crmSoldCredits = 0;
        let countInterior = 0;
        let countCiudad = 0;
        try {
            const [countRows] = await query(`
                SELECT COUNT(*) as count 
                FROM leads 
                WHERE estado_vendedor = 'ATENDIDO'
                  AND date_trunc('month', fecha_actualizacion) = date_trunc('month', CURRENT_DATE)
            `);
            if (countRows.length > 0) {
                crmSoldCredits = parseInt(countRows[0].count, 10) || 0;
            }

            const [regRows] = await query(`
                SELECT
                    COUNT(CASE WHEN tags ILIKE '%INTERIOR%' THEN 1 END) as interior_count,
                    COUNT(CASE WHEN tags ILIKE '%CIUDAD%' OR (tags NOT ILIKE '%INTERIOR%' AND tags IS NOT NULL) THEN 1 END) as ciudad_count
                FROM leads
                WHERE estado_vendedor = 'ATENDIDO'
                  AND date_trunc('month', fecha_actualizacion) = date_trunc('month', CURRENT_DATE)
            `);
            if (regRows.length > 0) {
                countInterior = parseInt(regRows[0].interior_count, 10) || 0;
                countCiudad = parseInt(regRows[0].ciudad_count, 10) || 0;
            }
        } catch (e) {}

        const totalSoldCredits = crmSoldCredits + manualCredits;
        const percentage = targetCredits > 0 ? Math.min(100, Math.round((totalSoldCredits / targetCredits) * 100)) : 0;

        const totalRevenue = revenueInterior + revenueCiudad;
        let pctInterior = 0;
        let pctCiudad = 0;
        if (totalRevenue > 0) {
            pctInterior = Math.round((revenueInterior / totalRevenue) * 100);
            pctCiudad = 100 - pctInterior;
        }

        res.json({
            success: true,
            monthKey,
            monthName,
            cac,
            roas,
            targetCredits,
            manualCredits,
            crmSoldCredits,
            totalSoldCredits,
            percentage,
            revenueInterior,
            revenueCiudad,
            totalRevenue,
            pctInterior,
            pctCiudad,
            countInterior,
            countCiudad,
            isAdmin: req.session && req.session.role === 'admin'
        });
    } catch (error) {
        console.error('Error fetching monthly KPIs:', error);
        res.status(500).json({ error: 'Failed to fetch monthly KPIs' });
    }
};

const updateMonthlyKpis = async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = String(now.getMonth() + 1).padStart(2, '0');
        const monthKey = req.body.monthKey || `${year}-${monthNum}`;

        const { cac, roas, targetCredits, manualCredits, revenueInterior, revenueCiudad } = req.body;

        let storedKpis = {};
        try {
            const [rows] = await query("SELECT value FROM bot_settings WHERE key = 'monthly_business_kpis'");
            if (rows.length > 0 && rows[0].value) {
                storedKpis = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
            }
        } catch (e) {}

        storedKpis[monthKey] = {
            cac: cac !== undefined && cac !== '' ? Number(cac) : (storedKpis[monthKey]?.cac || 0),
            roas: roas !== undefined && roas !== '' ? Number(roas) : (storedKpis[monthKey]?.roas || 0),
            target_credits: targetCredits !== undefined && targetCredits !== '' ? Number(targetCredits) : (storedKpis[monthKey]?.target_credits || 30),
            manual_credits: manualCredits !== undefined && manualCredits !== '' ? Number(manualCredits) : (storedKpis[monthKey]?.manual_credits || 0),
            revenue_interior: revenueInterior !== undefined && revenueInterior !== '' ? Number(revenueInterior) : (storedKpis[monthKey]?.revenue_interior || 0),
            revenue_ciudad: revenueCiudad !== undefined && revenueCiudad !== '' ? Number(revenueCiudad) : (storedKpis[monthKey]?.revenue_ciudad || 0),
            updated_at: new Date().toISOString()
        };

        await query(
            `INSERT INTO bot_settings (key, value) VALUES ('monthly_business_kpis', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(storedKpis)]
        );

        res.json({ success: true, message: 'KPIs mensuales actualizados correctamente', data: storedKpis[monthKey] });
    } catch (error) {
        console.error('Error updating monthly KPIs:', error);
        res.status(500).json({ error: 'Failed to update monthly KPIs' });
    }
};

module.exports = {
    getLeads,
    updateLeadStatus,
    sendManualMessage,
    updateLeadDetails,
    deleteLead,
    getBotFlow,
    updateBotFlow,
    assignLead,
    updateVendedorStatus,
    getLeadMessages,
    getMonthlyKpis,
    updateMonthlyKpis
};
