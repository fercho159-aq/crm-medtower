const { query } = require('../config/db');

// Asegurar existencia de columna social_networks
(async () => {
    try {
        await query(`ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS social_networks VARCHAR(255) DEFAULT 'Instagram'`);
    } catch (e) {}
})();

exports.getCards = async (req, res) => {
    try {
        const [rows] = await query('SELECT * FROM parrilla_cards WHERE deleted_at IS NULL ORDER BY order_index ASC, created_at DESC');
        res.json({ success: true, cards: rows });
    } catch (err) {
        console.error('Error fetching cards:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

exports.createCard = async (req, res) => {
    const { title, description, status, content_type, tags, funnel_stage, media_url, reference_url, cover_image_url, publish_date, assigned_to, priority, social_networks } = req.body;
    try {
        const [result] = await query(`
            INSERT INTO parrilla_cards (title, description, status, content_type, tags, funnel_stage, media_url, reference_url, cover_image_url, publish_date, assigned_to, priority, social_networks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [title, description, status || 'Marca', content_type, tags, funnel_stage, media_url, reference_url, cover_image_url, publish_date || null, assigned_to || null, priority || 'Normal', social_networks || 'Instagram']);
        
        res.json({ success: true, card: result[0] });
    } catch (err) {
        console.error('Error creating card:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
};

exports.updateCardStatus = async (req, res) => {
    const { id } = req.params;
    const { status, order_index } = req.body;
    
    try {
        // Fetch current status
        const [current] = await query('SELECT status FROM parrilla_cards WHERE id = $1', [id]);
        if (current.length === 0) return res.status(404).json({ error: 'Card not found' });
        
        const fromStatus = current[0].status;
        
        // Update the card
        let queryStr = 'UPDATE parrilla_cards SET status = $1, updated_at = NOW()';
        const params = [status, id];
        
        if (order_index !== undefined) {
            queryStr += ', order_index = $3';
            params.push(order_index);
        }
        
        queryStr += ' WHERE id = $2 RETURNING *';
        const [updated] = await query(queryStr, params);
        
        // If status changed, record history for time tracking
        if (fromStatus !== status) {
            await query(`
                INSERT INTO parrilla_history (card_id, from_status, to_status)
                VALUES ($1, $2, $3)
            `, [id, fromStatus, status]);
        }
        
        res.json({ success: true, card: updated[0] });
    } catch (err) {
        console.error('Error updating card status:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

exports.updateCard = async (req, res) => {
    const { id } = req.params;
    const { title, description, status, content_type, tags, funnel_stage, media_url, reference_url, cover_image_url, publish_date, assigned_to, priority, social_networks } = req.body;
    try {
        const [updated] = await query(`
            UPDATE parrilla_cards 
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                content_type = COALESCE($3, content_type),
                tags = COALESCE($4, tags),
                funnel_stage = COALESCE($5, funnel_stage),
                media_url = COALESCE($6, media_url),
                reference_url = COALESCE($7, reference_url),
                cover_image_url = COALESCE($8, cover_image_url),
                publish_date = $9,
                assigned_to = $10,
                status = COALESCE($11, status),
                priority = COALESCE($12, priority),
                social_networks = COALESCE($13, social_networks),
                updated_at = NOW()
            WHERE id = $14
            RETURNING *
        `, [title, description, content_type, tags, funnel_stage, media_url, reference_url, cover_image_url, publish_date || null, assigned_to || null, status || null, priority || null, social_networks || null, id]);
        
        if (updated.length === 0) return res.status(404).json({ error: 'Card not found' });
        res.json({ success: true, card: updated[0] });
    } catch (err) {
        console.error('Error updating card:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
};

exports.deleteCard = async (req, res) => {
    const { id } = req.params;
    try {
        await query('UPDATE parrilla_cards SET deleted_at = NOW() WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error soft-deleting card:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

exports.getDeletedCards = async (req, res) => {
    try {
        const [rows] = await query('SELECT * FROM parrilla_cards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
        res.json({ success: true, cards: rows });
    } catch (err) {
        console.error('Error fetching deleted cards:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

exports.restoreCard = async (req, res) => {
    const { id } = req.params;
    try {
        await query('UPDATE parrilla_cards SET deleted_at = NULL, updated_at = NOW() WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error restoring card:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

exports.hardDeleteCard = async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM parrilla_cards WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error hard deleting card:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

exports.sendCardAlert = async (req, res) => {
    const { id } = req.params;
    try {
        let card = {};
        if (id && id !== 'direct' && !isNaN(Number(id))) {
            const [rows] = await query('SELECT * FROM parrilla_cards WHERE id = $1', [id]);
            if (rows.length > 0) {
                card = rows[0];
            }
        }

        // Combinar con los datos actuales del formulario modal si vienen en req.body
        if (req.body && typeof req.body === 'object') {
            card = {
                ...card,
                title: req.body.title || card.title || 'Publicación de Parrilla',
                description: req.body.description !== undefined ? req.body.description : card.description,
                status: req.body.status || card.status,
                priority: req.body.priority || card.priority,
                content_type: req.body.content_type || card.content_type,
                tags: req.body.tags || card.tags,
                funnel_stage: req.body.funnel_stage || card.funnel_stage,
                assigned_to: req.body.assigned_to !== undefined ? req.body.assigned_to : card.assigned_to,
                publish_date: req.body.publish_date || card.publish_date,
                reference_url: req.body.reference_url !== undefined ? req.body.reference_url : card.reference_url,
                media_url: req.body.media_url !== undefined ? req.body.media_url : card.media_url,
                cover_image_url: req.body.cover_image_url || card.cover_image_url,
                social_networks: req.body.social_networks !== undefined ? req.body.social_networks : (card.social_networks || 'Instagram')
            };
        }

        const { sendCardNotificationToTeam, formatParrillaNotification } = require('./cronController');
        const formattedMessage = formatParrillaNotification(card);
        const result = await sendCardNotificationToTeam(card);
        
        if (result.sentCount === 0) {
            if (card.id) {
                try {
                    await query('UPDATE parrilla_cards SET pending_manual_alert = TRUE WHERE id = $1', [card.id]);
                } catch (qErr) {}
            }
            return res.status(200).json({ 
                success: false,
                queuedForRetry: true,
                whatsappConnected: result.whatsappConnected,
                formattedMessage,
                error: `⏳ WhatsApp sin conexión en este instante: El aviso quedó EN COLA AUTOMÁTICA y el servidor lo enviará apenas detecte conexión (o en el reintento cada 30 min). También puedes enviarlo manualmente aquí abajo:`,
                details: result.errors 
            });
        }
        
        if (card.id) {
            try {
                await query('UPDATE parrilla_cards SET reminder_sent_date = CURRENT_DATE, pending_manual_alert = FALSE WHERE id = $1', [card.id]);
            } catch (uErr) {}
        }
        
        res.json({ 
            success: true,
            whatsappConnected: true,
            formattedMessage,
            message: `¡Aviso enviado automáticamente por WhatsApp a ${result.sentCount} de ${result.total} números (Jess, Angel, Gre, Alexis)!`,
            result 
        });
    } catch (err) {
        console.error('Error sending card alert:', err);
        res.status(200).json({ 
            success: false,
            whatsappConnected: false,
            error: 'Error al enviar alerta automática: ' + err.message 
        });
    }
};

exports.sendStoriesAlert = async (req, res) => {
    try {
        const { sendDailyStoriesNotification } = require('./cronController');
        const result = await sendDailyStoriesNotification(true);

        if (result.sentCount === 0) {
            return res.status(200).json({
                success: false,
                queuedForRetry: true,
                whatsappConnected: result.whatsappConnected,
                formattedMessage: result.formattedMessage,
                error: '⏳ WhatsApp sin conexión en este instante: El aviso diario de Historias IG & TikTok quedó EN COLA AUTOMÁTICA y se enviará solo apenas conecte el QR (reintento cada 30 min). También puedes enviarlo ahora con 1 clic:'
            });
        }

        res.json({
            success: true,
            whatsappConnected: true,
            formattedMessage: result.formattedMessage,
            message: `¡Aviso diario de Historias (Instagram y TikTok) enviado automáticamente a ${result.sentCount} de ${result.total} números (Jess, Angel, Gre, Alexis)!`,
            result
        });
    } catch (err) {
        console.error('Error sending stories alert:', err);
        res.status(200).json({
            success: false,
            whatsappConnected: false,
            error: 'Error al enviar recordatorio de historias: ' + err.message
        });
    }
};
