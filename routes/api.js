const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

const { getLeads, updateLeadStatus, sendManualMessage, updateLeadDetails, deleteLead, getBotFlow, updateBotFlow, assignLead, updateVendedorStatus, getLeadMessages, getMonthlyKpis, updateMonthlyKpis } = require('../controllers/dashboardController');
const { login, logout, checkSession } = require('../controllers/authController');
const { handleWebhookVerification, handleIncomingMessage } = require('../controllers/botController');
const { runFollowUp, run24hFollowUp, checkParrillaReminders } = require('../controllers/cronController');
const { isAuthenticated, isAdmin, verifyCronApiKey } = require('../middlewares/auth');
const { listSellers, createSeller, deleteSeller, getSellersGoals } = require('../controllers/userController');
const features = require('../config/features');
const whatsappService = require('../services/whatsappService');

// DIAGNÓSTICO TEMPORAL — muestra el error real de la BD
router.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        const [tables] = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const [users] = await query('SELECT id, username FROM users LIMIT 5');
        res.json({
            status: 'OK',
            db_connection: true,
            tables: tables,
            users_found: users,
            env_check: {
                DB_HOST: process.env.DB_HOST || 'NOT SET',
                DATABASE_URL: process.env.DATABASE_URL ? 'SET ✓' : 'NOT SET ✗',
                NODE_ENV: process.env.NODE_ENV || 'NOT SET'
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 'ERROR',
            db_connection: false,
            error: err.message,
            error_code: err.code,
            env_check: {
                DATABASE_URL: process.env.DATABASE_URL ? 'SET ✓' : 'NOT SET ✗',
                NODE_ENV: process.env.NODE_ENV || 'NOT SET'
            }
        });
    }
});

// Auth routes
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/session', checkSession);

// Bot routes (Meta Webhook)
router.get('/webhook', handleWebhookVerification);
// Webhook POST will be protected by verifyMetaSignature middleware at the app level
router.post('/webhook', handleIncomingMessage);

// Cron routes
router.get('/cron/follow-up', verifyCronApiKey, runFollowUp);
router.post('/cron/follow-up', verifyCronApiKey, runFollowUp);
router.get('/cron/follow-up-24h', verifyCronApiKey, run24hFollowUp);
router.post('/cron/follow-up-24h', verifyCronApiKey, run24hFollowUp);
router.get('/cron/parrilla-reminders', verifyCronApiKey, checkParrillaReminders);
router.post('/cron/parrilla-reminders', verifyCronApiKey, checkParrillaReminders);

// Dashboard routes (Protected)
router.get('/leads', isAuthenticated, getLeads);
router.put('/leads/:id/status', isAuthenticated, updateLeadStatus);
router.put('/leads/:id/details', isAuthenticated, updateLeadDetails);
router.delete('/leads/:id', isAuthenticated, deleteLead);
router.post('/leads/:id/message', isAuthenticated, sendManualMessage);
router.get('/leads/:id/messages', isAuthenticated, getLeadMessages);
router.put('/leads/:id/assign', isAuthenticated, assignLead);
router.put('/leads/:id/vendedor-status', isAuthenticated, updateVendedorStatus);

// Seller management routes
router.get('/sellers', isAuthenticated, listSellers);
router.post('/sellers', isAuthenticated, isAdmin, createSeller);
router.delete('/sellers/:id', isAuthenticated, isAdmin, deleteSeller);
router.get('/sellers/goals', isAuthenticated, getSellersGoals);

// KPIs Mensuales de Negocio (CAC, ROAS, Meta 30 Créditos - Visible para TODOS los usuarios)
router.get('/kpis/monthly', isAuthenticated, getMonthlyKpis);
router.post('/kpis/monthly', isAuthenticated, isAdmin, updateMonthlyKpis);

// Parrilla de Contenido routes (Protected) — behind feature flag
if (features.PARRILLA) {
    const { getCards, createCard, updateCardStatus, updateCard, deleteCard, sendCardAlert, sendStoriesAlert, getDeletedCards, restoreCard, hardDeleteCard } = require('../controllers/parrillaController');
    router.get('/parrilla/cards', isAuthenticated, getCards);
    router.post('/parrilla/cards', isAuthenticated, createCard);
    router.put('/parrilla/cards/:id/status', isAuthenticated, updateCardStatus);
    router.put('/parrilla/cards/:id', isAuthenticated, updateCard);
    router.delete('/parrilla/cards/:id', isAuthenticated, deleteCard);
    router.post('/parrilla/cards/:id/send-alert', isAuthenticated, sendCardAlert);
    router.post('/parrilla/stories-alert', isAuthenticated, sendStoriesAlert);
    // Diagnóstico: último reporte de entrega por persona + número vinculado al CRM
    router.get('/parrilla/delivery-report', isAuthenticated, async (req, res) => {
        try {
            const [rows] = await query("SELECT value FROM bot_settings WHERE key = 'last_team_delivery_report'");
            const status = whatsappService.getStatus().map(s => ({ id: s.id, label: s.label, status: s.status, linkedPhone: s.linkedPhone }));
            res.json({ success: true, whatsapp: status, lastReport: rows.length ? rows[0].value : null });
        } catch (err) {
            res.json({ success: false, error: err.message });
        }
    });
    router.get('/parrilla/trash', isAuthenticated, getDeletedCards);
    router.post('/parrilla/cards/:id/restore', isAuthenticated, restoreCard);
    router.delete('/parrilla/cards/:id/hard', isAuthenticated, hardDeleteCard);
}

// Instagram Feed Route (Protected) — behind feature flag
if (features.INSTAGRAM) {
    const { getInstagramFeed } = require('../controllers/instagramController');
    router.get('/parrilla/instagram', isAuthenticated, getInstagramFeed);
}

// Feature flags endpoint
router.get('/features', (req, res) => {
    res.json(features);
});

// Bot flow config routes (Protected)
router.get('/bot/flow', isAuthenticated, getBotFlow);
router.put('/bot/flow', isAuthenticated, updateBotFlow);
router.get('/bot/logs', isAuthenticated, (req, res) => {
    res.json(global.botLogs || []);
});

// Flujo MIT (diagrama + editor de nodos)
const { getFlowMit, updateFlowNode, resetFlowNode } = require('../controllers/botFlowMitController');
router.get('/bot/flow-mit', isAuthenticated, getFlowMit);
router.put('/bot/flow-mit/node', isAuthenticated, isAdmin, updateFlowNode);
router.post('/bot/flow-mit/reset', isAuthenticated, isAdmin, resetFlowNode);

// WhatsApp routes
router.get('/whatsapp/status', isAuthenticated, (req, res) => {
    res.json(whatsappService.getStatus());
});

router.get('/whatsapp/qr/:accountId', isAuthenticated, (req, res) => {
    const qr = whatsappService.getQR(req.params.accountId);
    if (!qr) {
        return res.status(404).json({ error: 'QR no disponible. La cuenta puede estar ya conectada o aún iniciando.' });
    }
    // Devuelve HTML con el QR para escanear fácilmente
    res.send(`<!DOCTYPE html><html><head><title>QR WhatsApp - ${req.params.accountId}</title></head>
    <body style="background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:white;font-family:sans-serif">
    <h2>Escanea con WhatsApp Business</h2>
    <p style="color:#aaa">Cuenta: <strong style="color:lime">${req.params.accountId.toUpperCase()}</strong></p>
    <img src="${qr}" style="border-radius:12px;" />
    <p style="color:#aaa;margin-top:16px">La página se actualizará en 30 segundos...</p>
    <script>setTimeout(()=>location.reload(),30000)</script>
    </body></html>`);
});

router.post('/whatsapp/disconnect/:accountId', isAuthenticated, async (req, res) => {
    try {
        await whatsappService.disconnectAccount(req.params.accountId);
        res.json({ success: true, message: 'Sesión desvinculada. Se está reiniciando para generar un código QR limpio.' });
    } catch (err) {
        console.error(`Error al desvincular ${req.params.accountId}:`, err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
