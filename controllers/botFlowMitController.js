// Controller del Flujo MIT: expone el catálogo del bot para el diagrama
// y permite editar nodos (persistidos como overrides en bot_settings).

const { query } = require('../config/db');
const botCatalog = require('../config/botCatalog');

async function loadOverrides() {
    try {
        const [rows] = await query("SELECT value FROM bot_settings WHERE key = 'flow_mit_overrides'");
        if (rows.length === 0) return {};
        let v = rows[0].value;
        if (typeof v === 'string') try { v = JSON.parse(v); } catch(e) { return {}; }
        return v || {};
    } catch (e) {
        return {};
    }
}

async function saveOverrides(overrides) {
    const json = JSON.stringify(overrides || {});
    await query(
        `INSERT INTO bot_settings (key, value) VALUES ('flow_mit_overrides', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [json]
    );
}

// GET /api/bot/flow-mit
// Devuelve: catálogo live (defaults + overrides) + árbol de flujo + promoción activa + overrides actuales
exports.getFlowMit = async (req, res) => {
    try {
        const { live, getPromocion, getFlowTree, DEFAULTS } = botCatalog;
        const overrides = await loadOverrides();
        res.json({
            success: true,
            data: {
                catalogo: {
                    especialidades: live.ESPECIALIDADES,
                    procedimientos: live.PROCEDIMIENTOS,
                    laboratorio: live.LABORATORIO,
                    estudios: live.ESTUDIOS_CON_CITA,
                    clinica: live.CLINICA,
                    mensajes: live.MENSAJES,
                    promocion: live.PROMOCION,
                },
                defaults: {
                    especialidades: DEFAULTS.ESPECIALIDADES,
                    procedimientos: DEFAULTS.PROCEDIMIENTOS,
                    laboratorio: DEFAULTS.LABORATORIO,
                    estudios: DEFAULTS.ESTUDIOS_CON_CITA,
                    clinica: DEFAULTS.CLINICA,
                    mensajes: DEFAULTS.MENSAJES,
                    promocion: DEFAULTS.PROMOCION,
                },
                overrides,
                flujo: getFlowTree(),
                promocion_activa: getPromocion(),
            }
        });
    } catch (e) {
        console.error('[FlowMit:get]', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// Valida y sanea un parche sobre un item del catálogo.
// Nunca permite cambiar el id, aliases, emoji, cat, esMenor (campos estructurales).
function sanitizeItemPatch(patch, allowed) {
    const clean = {};
    for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) clean[k] = patch[k];
    }
    return clean;
}

const ALLOWED_ESP = ['costo', 'anticipo', 'resto', 'horario', 'nota', 'asesorConfirma', 'sinCita', 'sinAnticipo'];
const ALLOWED_PROC = ['desde', 'nota'];
const ALLOWED_LAB = ['precio', 'nota'];
const ALLOWED_EST = ['costo', 'anticipo', 'resto', 'desc', 'asesorConfirma'];
const ALLOWED_CLINICA = ['direccion', 'whatsapp', 'web', 'email', 'horario', 'maps'];
const ALLOWED_MENSAJES = ['SALUDO_MENU', 'CIERRE_VENTA', 'CIERRE_SIN_VENTA', 'CIERRE_SIN_VENTA_DISTANCIA', 'EMERGENCIA', 'CRISIS', 'PEDIR_NOMBRE', 'PEDIR_NOMBRE_VALORACION', 'PEDIR_NOMBRE_ESTUDIO', 'ESCALAR_ASESOR'];
const ALLOWED_PROMO = ['activa_hasta', 'texto', 'aplica_a_procedimiento_id'];

// PUT /api/bot/flow-mit/node
// Body: { tipo: 'especialidad'|'procedimiento'|'laboratorio'|'estudio'|'clinica'|'mensaje'|'promocion', id?: string, patch: {...} }
exports.updateFlowNode = async (req, res) => {
    try {
        const { tipo, id, patch } = req.body || {};
        if (!tipo || typeof patch !== 'object' || patch === null) {
            return res.status(400).json({ success: false, error: 'Faltan campos (tipo, patch).' });
        }

        const overrides = await loadOverrides();

        const applyArrayPatch = (collectionKey, allowed, liveArr) => {
            if (!id) throw new Error(`id requerido para tipo=${tipo}`);
            const exists = liveArr.find(x => x.id === id);
            if (!exists) throw new Error(`No existe ${tipo} con id="${id}"`);
            const clean = sanitizeItemPatch(patch, allowed);
            if (!Object.keys(clean).length) throw new Error('Patch sin campos válidos');
            overrides[collectionKey] = overrides[collectionKey] || {};
            overrides[collectionKey][id] = { ...(overrides[collectionKey][id] || {}), ...clean };
        };

        const { live } = botCatalog;

        switch (tipo) {
            case 'especialidad':
                applyArrayPatch('especialidades', ALLOWED_ESP, live.ESPECIALIDADES);
                break;
            case 'procedimiento':
                applyArrayPatch('procedimientos', ALLOWED_PROC, live.PROCEDIMIENTOS);
                break;
            case 'laboratorio':
                applyArrayPatch('laboratorio', ALLOWED_LAB, live.LABORATORIO);
                break;
            case 'estudio':
                applyArrayPatch('estudios', ALLOWED_EST, live.ESTUDIOS_CON_CITA);
                break;
            case 'clinica': {
                const clean = sanitizeItemPatch(patch, ALLOWED_CLINICA);
                if (!Object.keys(clean).length) throw new Error('Patch sin campos válidos');
                overrides.clinica = { ...(overrides.clinica || {}), ...clean };
                break;
            }
            case 'mensaje': {
                const clean = sanitizeItemPatch(patch, ALLOWED_MENSAJES);
                if (!Object.keys(clean).length) throw new Error('Patch sin campos válidos');
                overrides.mensajes = { ...(overrides.mensajes || {}), ...clean };
                break;
            }
            case 'promocion': {
                const clean = sanitizeItemPatch(patch, ALLOWED_PROMO);
                if (!Object.keys(clean).length) throw new Error('Patch sin campos válidos');
                overrides.promocion = { ...(overrides.promocion || {}), ...clean };
                break;
            }
            default:
                return res.status(400).json({ success: false, error: `tipo "${tipo}" no soportado` });
        }

        await saveOverrides(overrides);
        // Reaplicar en memoria (reset + apply para evitar drift tras ediciones repetidas)
        botCatalog.resetOverrides();
        botCatalog.applyOverrides(overrides);

        res.json({ success: true, overrides });
    } catch (e) {
        console.error('[FlowMit:update]', e.message);
        res.status(400).json({ success: false, error: e.message });
    }
};

// POST /api/bot/flow-mit/reset
// Body: { tipo?: '...', id?: '...' } — sin body: reset total. Con tipo+id: reset solo ese nodo.
exports.resetFlowNode = async (req, res) => {
    try {
        const { tipo, id } = req.body || {};
        const overrides = await loadOverrides();

        if (!tipo) {
            // Reset total
            await saveOverrides({});
            botCatalog.resetOverrides();
            return res.json({ success: true, message: 'Todos los overrides borrados.', overrides: {} });
        }

        const bucket = {
            especialidad: 'especialidades',
            procedimiento: 'procedimientos',
            laboratorio: 'laboratorio',
            estudio: 'estudios',
            clinica: 'clinica',
            mensaje: 'mensajes',
            promocion: 'promocion',
        }[tipo];

        if (!bucket) return res.status(400).json({ success: false, error: `tipo "${tipo}" no soportado` });

        if (['clinica', 'mensaje', 'promocion'].includes(tipo)) {
            delete overrides[bucket];
        } else {
            if (!id) return res.status(400).json({ success: false, error: 'id requerido' });
            if (overrides[bucket]) delete overrides[bucket][id];
            if (overrides[bucket] && !Object.keys(overrides[bucket]).length) delete overrides[bucket];
        }

        await saveOverrides(overrides);
        botCatalog.resetOverrides();
        botCatalog.applyOverrides(overrides);

        res.json({ success: true, overrides });
    } catch (e) {
        console.error('[FlowMit:reset]', e.message);
        res.status(400).json({ success: false, error: e.message });
    }
};
