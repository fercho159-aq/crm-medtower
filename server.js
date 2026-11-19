require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { verifyMetaSignature } = require('./middlewares/metaWebhook');

const features = require('./config/features');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');
const whatsappService = require('./services/whatsappService');
const botController = require('./controllers/botController');
const socketService = require('./services/socketService');

const app = express();
const PORT = process.env.PORT || 3000;

// SSL config (declared early so session cookie can reference it)
const sslCert = process.env.SSL_CERT_PATH;
const sslKey = process.env.SSL_KEY_PATH;

// CRITICO para hosting: corre detras de un proxy reverso (Nginx)
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: ['https://medtower.com.mx', 'https://crmmedtower.mawsoluciones.com', 'http://localhost:3000', 'http://localhost:8444'],
    credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 8000, // Limit each IP to 8000 requests per window to avoid 429 errors behind proxy
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter); // apply to all API routes

// Session Management
app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secret',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Necesario detras del proxy
    cookie: {
        secure: !!(sslCert && sslKey),
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Custom JSON parser to allow Webhook signature validation
app.use(express.json({
    limit: '15mb',
    verify: (req, res, buf, encoding) => {
        // Only verify signature for webhook endpoints
        if (req.path === '/api/webhook' && req.method === 'POST') {
            verifyMetaSignature(req, res, buf, encoding);
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static files (Dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// Fallback for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

const { query } = require('./config/db');

// Crear servidor HTTP o HTTPS segun la configuracion SSL
let server;
if (sslCert && sslKey && fs.existsSync(sslCert) && fs.existsSync(sslKey)) {
    const options = { cert: fs.readFileSync(sslCert), key: fs.readFileSync(sslKey) };
    server = https.createServer(options, app);
    console.log('[Server] HTTPS habilitado con certificado SSL');
} else {
    server = http.createServer(app);
    console.log('[Server] HTTP mode (sin SSL o detras de reverse proxy)');
}

// Inicializar Socket.io
socketService.init(server);

server.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);

    // Ejecutar migracion automatica de base de datos
    try {
        console.log('[DB] Ejecutando migracion de base de datos...');
        await query('ALTER TABLE leads ALTER COLUMN telefono TYPE VARCHAR(100)');
        await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS cuenta VARCHAR(50) DEFAULT 'principal'");
        await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags VARCHAR(100)");

        if (features.PARRILLA) {
            // Agregar funnel_stage y urls a parrilla_cards por si ya se habia creado
            try {
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS funnel_stage VARCHAR(50)");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS media_url VARCHAR(255)");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS reference_url VARCHAR(255)");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS cover_image_url TEXT");
            } catch (e) {
                console.error(e);
            }
        }

        // Crear tabla de historial de mensajes si no existe
        await query(`
            CREATE TABLE IF NOT EXISTS mensajes (
                id SERIAL PRIMARY KEY,
                lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
                emisor VARCHAR(20) NOT NULL CHECK (emisor IN ('CLIENTE', 'BOT', 'HUMANO')),
                texto TEXT NOT NULL,
                tipo VARCHAR(20) NOT NULL DEFAULT 'text',
                cuenta VARCHAR(50) NOT NULL DEFAULT 'principal',
                fecha TIMESTAMP DEFAULT NOW()
            )
        `);
        await query('CREATE INDEX IF NOT EXISTS idx_mensajes_lead_id ON mensajes(lead_id)');
        await query("UPDATE leads SET telefono = telefono || '@s.whatsapp.net' WHERE telefono NOT LIKE '%@%'");
        // Migracion de Roles de Usuario
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'vendedor'");
        try {
            await query("ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role");
        } catch (roleConstraintErr) {
            // Ignorar
        }
        await query("UPDATE users SET role = 'admin' WHERE username = 'admin'");

        // Sembrar usuario admin si no existe
        try {
            await query("INSERT INTO users (username, password_hash, role) VALUES ('admin', '$2b$12$X6xAClAeausaP3EAeVy4/O6YGbRSlyjfUc6fDpp0aQOl2hZiGd6PC', 'admin') ON CONFLICT (username) DO NOTHING");
        } catch(uErr) {}

        // Migracion de Asignacion y Estatus del Vendedor en Leads
        await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS vendedor_id INT REFERENCES users(id) ON DELETE SET NULL");
        await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado_vendedor VARCHAR(30) DEFAULT 'NINGUNO'");
        await query("ALTER TABLE leads ALTER COLUMN tags TYPE TEXT");
        await query("ALTER TABLE leads ADD COLUMN IF NOT EXISTS seguimiento_24h_enviado BOOLEAN DEFAULT FALSE");
        try {
            await query("ALTER TABLE leads ADD CONSTRAINT check_estado_vendedor CHECK (estado_vendedor IN ('NINGUNO', 'EN_SEGUIMIENTO', 'CITA_AGENDADA', 'ATENDIDO', 'DESCARTADO'))");
        } catch (statusConstraintErr) {
            // Ya existe la restriccion
        }

        // Crear tabla de configuraciones de bot
        await query(`
            CREATE TABLE IF NOT EXISTS bot_settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value JSONB NOT NULL
            )
        `);

        if (features.PARRILLA) {
            // Crear tablas para la Parrilla de Contenido
            await query(`
                CREATE TABLE IF NOT EXISTS parrilla_cards (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'Ideas de Contenido',
                    content_type VARCHAR(50),
                    tags VARCHAR(255),
                    funnel_stage VARCHAR(50),
                    media_url VARCHAR(255),
                    reference_url TEXT,
                    cover_image_url TEXT,
                    publish_date TIMESTAMP,
                    order_index INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            try {
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(50)");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Normal'");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS reminder_sent_date DATE");
                await query("ALTER TABLE parrilla_cards ALTER COLUMN reference_url TYPE TEXT");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL");
                await query("ALTER TABLE parrilla_cards ADD COLUMN IF NOT EXISTS pending_manual_alert BOOLEAN DEFAULT FALSE");
            } catch(e) {}

            await query(`
                CREATE TABLE IF NOT EXISTS parrilla_history (
                    id SERIAL PRIMARY KEY,
                    card_id INT NOT NULL REFERENCES parrilla_cards(id) ON DELETE CASCADE,
                    from_status VARCHAR(50),
                    to_status VARCHAR(50),
                    changed_at TIMESTAMP DEFAULT NOW()
                )
            `);
        }

        // Insertar flujo inicial por defecto si no existe
        const [rows] = await query("SELECT value FROM bot_settings WHERE key = 'flow_config'");
        const defaultConfig = {
            enabled: true,
            enabled_principal: true,
        };
        if (rows.length === 0) {
            await query("INSERT INTO bot_settings (key, value) VALUES ('flow_config', $1)", [JSON.stringify(defaultConfig)]);
            console.log('[DB] Configuracion de flujo inicial del Bot inyectada');
        } else {
            // Parchado dinamico de la configuracion existente
            const existing = rows[0].value;
            let updated = false;
            for (const key in defaultConfig) {
                if (existing[key] === undefined) {
                    existing[key] = defaultConfig[key];
                    updated = true;
                }
            }
            if (updated) {
                await query("UPDATE bot_settings SET value = $1 WHERE key = 'flow_config'", [JSON.stringify(existing)]);
                console.log('[DB] Configuracion de flujo existente parchada con nuevos campos');
            }
        }

        // Cargar overrides del catálogo MIT (precios, horarios, mensajes editados desde el CRM)
        try {
            const botCatalog = require('./config/botCatalog');
            const [overrideRows] = await query("SELECT value FROM bot_settings WHERE key = 'flow_mit_overrides'");
            if (overrideRows.length === 0) {
                await query("INSERT INTO bot_settings (key, value) VALUES ('flow_mit_overrides', $1)", ['{}']);
                console.log('[DB] Overrides del flujo MIT inicializados (vacío → defaults del catálogo)');
            } else {
                let overrides = overrideRows[0].value;
                if (typeof overrides === 'string') try { overrides = JSON.parse(overrides); } catch(e) { overrides = {}; }
                botCatalog.applyOverrides(overrides);
                const keys = Object.keys(overrides || {});
                if (keys.length > 0) console.log(`[DB] Overrides del flujo MIT aplicados: ${keys.join(', ')}`);
            }
        } catch (ovErr) {
            console.error('[DB] Error aplicando overrides del flujo MIT:', ovErr.message);
        }

        console.log('[DB] Migracion completada');
    } catch (dbErr) {
        console.error('[DB] Error en migracion:', dbErr.message);
    }

    const { checkParrillaReminders, run24hFollowUp } = require('./controllers/cronController');

    if (features.PARRILLA) {
        // Al detectar que el WhatsApp se conecta, vaciar de inmediato la cola pendiente
        global.onWhatsAppConnectedFlushQueue = async (accountId) => {
            try {
                await checkParrillaReminders(null, null);
            } catch (err) {
                console.error('[Parrilla Cola] Error al enviar cola tras conexion de WhatsApp:', err.message);
            }
        };
    }

    // Registrar el handler de mensajes de WhatsApp
    whatsappService.registerMessageHandler(botController.handleWhatsAppMessage);
    // Iniciar conexiones de WhatsApp
    whatsappService.initAll();

    if (features.PARRILLA) {
        // Chequeo inicial 15 seg tras arrancar el servidor
        setTimeout(async () => {
            try {
                await checkParrillaReminders(null, null);
            } catch (err) {
                console.error('[Parrilla Cron] Error en chequeo inicial:', err.message);
            }
        }, 15000);
    }

    // Reloj de precision: Dispara cada 30 minutos (:00 y :30)
    let lastCheckedSlot = '';
    setInterval(async () => {
        try {
            const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: features.BRAND_TIMEZONE }));
            const h = nowLocal.getHours();
            const m = nowLocal.getMinutes();
            const slotKey = `${nowLocal.getFullYear()}-${nowLocal.getMonth()}-${nowLocal.getDate()}-${h}-${m}`;

            // Ejecutar puntualmente cada 30 minutos (:00 y :30)
            if (m === 0 || m === 30) {
                if (lastCheckedSlot !== slotKey) {
                    lastCheckedSlot = slotKey;
                    if (features.PARRILLA) {
                        await checkParrillaReminders(null, null);
                    }
                    await run24hFollowUp(null, null);
                }
            }
        } catch (err) {
            console.error('[Cron 30m] Error en chequeo periodico:', err.message);
        }
    }, 45 * 1000);
});
