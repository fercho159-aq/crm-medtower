const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Clientes activos
const clients = {};
const qrCodes = {};
const status = {};
const sentMessagesCache = new Set();

// Handlers de mensajes entrantes (se registran desde botController)
let messageHandler = null;

const parseAccounts = () => {
    const envVal = process.env.WHATSAPP_ACCOUNTS || 'principal:Línea Principal';
    const accounts = {};
    envVal.split(',').forEach(entry => {
        const [id, label] = entry.trim().split(':');
        if (id) {
            accounts[id.trim()] = {
                id: id.trim(),
                label: label ? label.trim() : id.trim(),
                sessionDir: path.join(__dirname, '../sessions', id.trim())
            };
        }
    });
    return accounts;
};

const ACCOUNTS = parseAccounts();

const connectAccount = async (accountId) => {
    const account = ACCOUNTS[accountId];
    if (!account) throw new Error(`Cuenta desconocida: ${accountId}`);

    // Crear directorio de sesión si no existe
    if (!fs.existsSync(account.sessionDir)) {
        fs.mkdirSync(account.sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(account.sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) }) }
    });

    clients[accountId] = sock;
    status[accountId] = 'connecting';

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                qrCodes[accountId] = await QRCode.toDataURL(qr);
                status[accountId] = 'qr_pending';
                console.log(`[WA:${account.label}] QR generado — escanea en /api/whatsapp/qr/${accountId}`);
            } catch (err) {
                console.error(`[WA:${account.label}] Error generando QR:`, err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[WA:${account.label}] Conexión cerrada. Reconectar: ${shouldReconnect}`);
            status[accountId] = 'disconnected';
            qrCodes[accountId] = null;
            if (shouldReconnect) {
                setTimeout(() => connectAccount(accountId), 5000);
            } else {
                // Sesión cerrada — borrar archivos y volver a conectar
                fs.rmSync(account.sessionDir, { recursive: true, force: true });
                setTimeout(() => connectAccount(accountId), 3000);
            }
        }

        if (connection === 'open') {
            console.log(`[WA:${account.label}] ✅ Conectado`);
            status[accountId] = 'connected';
            qrCodes[accountId] = null;
            if (typeof global.onWhatsAppConnectedFlushQueue === 'function') {
                setTimeout(() => {
                    console.log(`[WA:${account.label}] 🔄 Conexión detectada — procesando cola de avisos pendientes de Parrilla e Historias...`);
                    global.onWhatsAppConnectedFlushQueue(accountId);
                }, 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (msg.key.fromMe) {
                if (sentMessagesCache.has(msg.key.id)) {
                    sentMessagesCache.delete(msg.key.id);
                    continue;
                }
            }
            if (messageHandler) {
                try {
                    await messageHandler(accountId, sock, msg);
                } catch (err) {
                    console.error(`[WA:${account.label}] Error procesando mensaje:`, err);
                }
            }
        }
    });

    return sock;
};

const withTimeout = (promise, ms = 10000, errorMsg = 'Tiempo de espera agotado al enviar mensaje por WhatsApp') => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
    ]);
};

const sendMessage = async (accountId, jid, text) => {
    const acc = (accountId && status[accountId] === 'connected' && clients[accountId]) ? accountId : getConnectedAccount();
    const sock = acc ? clients[acc] : null;
    if (!sock || status[acc] !== 'connected') {
        throw new Error(`WhatsApp (${accountId || 'bot'}) no está conectado. Abre 'Estado de Conexión' y escanea el código QR.`);
    }
    // jid debe ser formato: 50763039020@s.whatsapp.net
    const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    const sent = await withTimeout(sock.sendMessage(fullJid, { text }), 10000);
    if (sent && sent.key && sent.key.id) {
        sentMessagesCache.add(sent.key.id);
        setTimeout(() => sentMessagesCache.delete(sent.key.id), 600000);
    }
    return sent;
};

const sendButtons = async (accountId, jid, text, buttons) => {
    const acc = (accountId && status[accountId] === 'connected' && clients[accountId]) ? accountId : getConnectedAccount();
    const sock = acc ? clients[acc] : null;
    if (!sock || status[acc] !== 'connected') {
        throw new Error(`WhatsApp ${accountId} no está conectado`);
    }
    const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;

    // Clean duplicate leading numbers in titles (e.g., "1. Servicio" -> "Servicio")
    const cleanedButtons = buttons.map(b => ({
        ...b,
        title: b.title.replace(/^\d+[\s.-]+/, '')
    }));

    // Check if the text already contains a numbered option corresponding to the first button
    const firstButtonTitle = cleanedButtons[0]?.title || '';
    const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normTitle = normalize(firstButtonTitle);
    const normText = normalize(text);
    const hasOptionsInText = normTitle && normText.includes(`1${normTitle}`);

    let sent;
    if (hasOptionsInText) {
        // Just send the text as is, since options are already described in the text body
        sent = await withTimeout(sock.sendMessage(fullJid, { text }), 10000);
    } else {
        // Baileys sends as text list since interactive buttons require BSP
        const buttonText = cleanedButtons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
        sent = await withTimeout(sock.sendMessage(fullJid, { text: `${text}\n\n${buttonText}` }), 10000);
    }
    if (sent && sent.key && sent.key.id) {
        sentMessagesCache.add(sent.key.id);
        setTimeout(() => sentMessagesCache.delete(sent.key.id), 600000);
    }
    return sent;
};

const getConnectedAccount = () => {
    const preferredOrder = ['principal', ...Object.keys(ACCOUNTS).filter(k => k !== 'principal')];
    for (const id of preferredOrder) {
        if (status[id] === 'connected' && clients[id]) {
            return id;
        }
    }
    return null;
};

const sendMediaMessage = async (accountId, jid, mediaUrlOrBase64, caption = '') => {
    const acc = (accountId && status[accountId] === 'connected' && clients[accountId]) ? accountId : getConnectedAccount();
    const sock = acc ? clients[acc] : null;
    if (!sock || status[acc] !== 'connected') {
        throw new Error(`WhatsApp no está conectado en el servidor. Abre 'Estado de Conexión' y vincula tu línea con el código QR.`);
    }
    const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    let sent = null;

    if (mediaUrlOrBase64 && typeof mediaUrlOrBase64 === 'string' && mediaUrlOrBase64.trim()) {
        try {
            if (mediaUrlOrBase64.startsWith('data:image')) {
                const base64Data = mediaUrlOrBase64.split(',')[1] || mediaUrlOrBase64;
                const buffer = Buffer.from(base64Data, 'base64');
                sent = await withTimeout(sock.sendMessage(fullJid, { image: buffer, caption: caption }), 12000);
            } else if (mediaUrlOrBase64.startsWith('http')) {
                sent = await withTimeout(sock.sendMessage(fullJid, { image: { url: mediaUrlOrBase64 }, caption: caption }), 12000);
            }
        } catch (mediaErr) {
            console.error('[WA] Falló envío con imagen, enviando texto como fallback:', mediaErr.message);
        }
    }

    if (!sent) {
        sent = await withTimeout(sock.sendMessage(fullJid, { text: caption }), 10000);
    }

    if (sent && sent.key && sent.key.id) {
        sentMessagesCache.add(sent.key.id);
        setTimeout(() => sentMessagesCache.delete(sent.key.id), 600000);
    }
    return sent;
};

const registerMessageHandler = (handler) => {
    messageHandler = handler;
};

const getStatus = () => {
    return Object.keys(ACCOUNTS).map(id => ({
        id,
        label: ACCOUNTS[id].label,
        status: status[id] || 'not_started',
        linkedPhone: (clients[id] && clients[id].user && clients[id].user.id) ? String(clients[id].user.id).split(':')[0].split('@')[0] : null,
        hasQR: !!qrCodes[id],
        qr: qrCodes[id] || null
    }));
};

const getQR = (accountId) => qrCodes[accountId] || null;

const disconnectAccount = async (accountId) => {
    const account = ACCOUNTS[accountId];
    if (!account) throw new Error(`Cuenta desconocida: ${accountId}`);

    console.log(`[WA:${account.label}] ⚠️ Desconexión manual solicitada. Limpiando sesión...`);
    const sock = clients[accountId];
    if (sock) {
        try {
            await sock.logout();
        } catch (err) {
            console.log(`[WA:${account.label}] Error en logout:`, err.message);
            try {
                sock.end();
            } catch (e) {}
        }
        delete clients[accountId];
    }

    // Borrado físico de la sesión para evitar bloqueos
    if (fs.existsSync(account.sessionDir)) {
        fs.rmSync(account.sessionDir, { recursive: true, force: true });
        console.log(`[WA:${account.label}] Directorio de sesión eliminado: ${account.sessionDir}`);
    }

    status[accountId] = 'disconnected';
    qrCodes[accountId] = null;

    // Reiniciar conexión para que genere un nuevo QR
    setTimeout(() => {
        connectAccount(accountId).catch(err => {
            console.error(`[WA:${accountId}] Error al reconectar tras desvinculación:`, err.message);
        });
    }, 3000);
};

const initAll = async () => {
    console.log('[WhatsApp] Iniciando conexiones...');
    for (const accountId of Object.keys(ACCOUNTS)) {
        try {
            // Si la cuenta tiene configurada la API Cloud de Meta, omitimos la conexión Baileys
            // MODIFICACIÓN: Forzamos hasMeta a false para arrancar los QR de Baileys sí o sí.
            const hasMeta = false; 

            if (hasMeta) {
                console.log(`[WA:${ACCOUNTS[accountId].label}] Configurado con API Cloud de Meta. Omitiendo socket Baileys.`);
                status[accountId] = 'meta_connected';
                continue;
            }

            await connectAccount(accountId);
        } catch (err) {
            console.error(`[WA:${accountId}] Error al iniciar:`, err.message);
        }
    }
};

// Verifica si un número existe en WhatsApp y devuelve el JID real que reporta WhatsApp.
// También detecta si el destinatario es el mismo número vinculado al CRM (chat consigo mismo = sin notificación).
const checkNumber = async (accountId, phone) => {
    const acc = (accountId && status[accountId] === 'connected' && clients[accountId]) ? accountId : getConnectedAccount();
    const sock = acc ? clients[acc] : null;
    const clean = String(phone).replace(/[^0-9]/g, '');
    const result = { exists: null, jid: null, isSelf: false };
    if (!sock) return result;

    try {
        const ownId = sock.user && sock.user.id ? String(sock.user.id).split(':')[0].split('@')[0] : '';
        result.isSelf = !!ownId && ownId === clean;
    } catch (e) {}

    try {
        const res = await withTimeout(sock.onWhatsApp(clean), 8000, 'Timeout verificando número');
        if (Array.isArray(res) && res.length > 0) {
            result.exists = !!res[0].exists;
            result.jid = res[0].jid || null;
        } else {
            result.exists = false;
        }
    } catch (err) {
        // Si la verificación falla (timeout, etc.), no bloqueamos el envío: exists queda en null.
        console.warn(`[WA] No se pudo verificar ${clean}: ${err.message}`);
    }
    return result;
};

module.exports = {
    initAll,
    sendMessage,
    sendButtons,
    sendMediaMessage,
    checkNumber,
    getConnectedAccount,
    registerMessageHandler,
    getStatus,
    getQR,
    disconnectAccount,
    ACCOUNTS
};
