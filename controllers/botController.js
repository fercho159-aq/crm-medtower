const { query } = require('../config/db');
const { encrypt } = require('../config/encryption');
const whatsappService = require('../services/whatsappService');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const features = require('../config/features');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════
//  MIT Medical Tower — Catálogo de especialidades y servicios
// ═══════════════════════════════════════════════════════════════

const ESPECIALIDADES = [
    { id: 'cardiologia', nombre: 'Cardiología', emoji: '❤️', incluye: 'Enfermedades coronarias, arritmias, valvulopatías, cardiomiopatías, insuficiencia cardíaca, enfermedades congénitas del corazón' },
    { id: 'urologia', nombre: 'Urología', emoji: '🩺', incluye: 'Cáncer de próstata, disfunción eréctil, varicocele, incontinencia urinaria, cálculos renales, ETS' },
    { id: 'ginecologia', nombre: 'Ginecología', emoji: '🌸', incluye: 'Atención prenatal, parto, planificación familiar, menopausia, enfermedades del útero y ovarios, ETS' },
    { id: 'traumatologia', nombre: 'Traumatología y Ortopedia', emoji: '🦴', incluye: 'Fracturas, esguinces, tendinitis, artritis, dolor de espalda, lesiones deportivas' },
    { id: 'neurologia', nombre: 'Neurología', emoji: '🧠', incluye: 'Enfermedades cerebrovasculares, neurodegenerativas, epilepsia, esclerosis múltiple, tumores cerebrales' },
    { id: 'gastroenterologia', nombre: 'Gastroenterología', emoji: '🫁', incluye: 'Reflujo gastroesofágico (ERGE), úlceras pépticas, enfermedad inflamatoria intestinal, cáncer de colon, hepatitis' },
    { id: 'dermatologia', nombre: 'Dermatología', emoji: '🧴', incluye: 'Acné, eczema, psoriasis, dermatitis, cáncer de piel, envejecimiento prematuro' },
    { id: 'oncologia', nombre: 'Oncología', emoji: '🎗️', incluye: 'Quimioterapia, radioterapia, inmunoterapia, cirugía oncológica' },
    { id: 'pediatria', nombre: 'Pediatría', emoji: '👶', incluye: 'Vacunas, exámenes físicos, diagnóstico y tratamiento de enfermedades infantiles' },
    { id: 'nefrologia', nombre: 'Nefrología', emoji: '🫘', incluye: 'Enfermedad renal crónica, cálculos renales, infección del tracto urinario' },
    { id: 'otorrino', nombre: 'Otorrinolaringología', emoji: '👂', incluye: 'Infecciones del oído, pérdida auditiva, tinnitus, problemas de nariz y garganta' },
    { id: 'cirugia_plastica', nombre: 'Cirugía Plástica', emoji: '✨', incluye: 'Rellenos faciales, bótox, láser, liposucción, abdominoplastia, aumento de senos' },
    { id: 'angiologia', nombre: 'Angiología', emoji: '🫀', incluye: 'Enfermedad venosa, enfermedad arterial' },
    { id: 'psicologia', nombre: 'Psicología', emoji: '🧘', incluye: 'Ansiedad, depresión, trastorno bipolar, esquizofrenia' },
    { id: 'medicina_interna', nombre: 'Medicina Interna (Infectología)', emoji: '🦠', incluye: 'Infecciones respiratorias, ETS, infecciones de piel, hongos, VIH, hepatitis' },
];

const CIRUGIAS_PRECIOS = [
    { nombre: 'Mamoplastia de aumento', precio: '$60,000 MXN' },
    { nombre: 'Rinoplastia ultrasónica', precio: '$47,999 MXN' },
    { nombre: 'Rinoplastia tradicional', precio: '$36,999 MXN' },
    { nombre: 'Alectomía', precio: '$12,000 MXN (+$5,000 combo con rinoplastia)' },
    { nombre: 'Mommy Makeover', precio: 'Consulta precio con asesor' },
    { nombre: 'Abdominoplastia', precio: 'Consulta precio con asesor' },
];

const SERVICIOS_DIAGNOSTICO = [
    { nombre: 'Ultrasonografía', desc: 'Estudios de imagen con ultrasonido de alta definición' },
    { nombre: 'Radiología', desc: 'Rayos X y estudios radiológicos digitales' },
    { nombre: 'Laboratorio clínico', desc: 'Análisis de sangre, orina y más' },
    { nombre: 'Cirugía General', desc: 'Quirófano equipado con tecnología Prázise' },
];

const INFO_UBICACION = `📍 *MIT Medical Tower*\n\n🏢 Blvrd Prados de Aragón 8B, Prados de Aragón, 57179 Cdad. Nezahualcóyotl, Méx.\n\n🕐 *Horario:* Lunes a Viernes, 9:00 am – 5:00 pm\n\n📞 *Teléfono/WhatsApp:* +52 55 2838 0715\n📧 *Email:* mitmedicalt@yahoo.com\n\n📌 *Google Maps:*\nhttps://maps.app.goo.gl/cPKQ7FqE3vj93rrw8`;

const INFO_SUEROS = `💉 *Sueros Raimalab — MIT Medical Tower*\n\nTerapia intravenosa con sueros vitaminados para mejorar tu bienestar:\n\n🍊 *Suero Vita C* — desde *$650 MXN*\nRefuerza tu sistema inmunológico y combate el cansancio.\n\n✨ *Suero Glutatión* — desde *$850 MXN*\nAntioxidante potente, mejora la piel y desintoxica.\n\n¿Te gustaría agendar tu sesión? Responde *"agendar"* o escribe *"menú"* para volver.`;

// ═══════════════════════════════════════════════════════════════

const handleWebhookVerification = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
};

const sendMetaMessage = async (accountId, to, body, buttons = null) => {
    const token = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_ID;

    if (!phoneId || !token) {
        console.error(`[Meta:${accountId}] Configuración faltante. phoneId=${phoneId}, token=${token ? 'SET' : 'NOT SET'}`);
        return;
    }

    let messageData = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
    };

    if (buttons) {
        messageData.type = "interactive";
        messageData.interactive = {
            type: "button",
            body: { text: body },
            action: { buttons: buttons }
        };
    } else {
        messageData.type = "text";
        messageData.text = { body: body };
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[Meta:${accountId}] Error API Meta: ${response.status} — ${errBody}`);
        }
    } catch (error) {
        console.error(`[Meta:${accountId}] Error al enviar mensaje Meta:`, error);
    }
};

const handleIncomingMessage = async (req, res) => {
    const body = req.body;

    if (body.object) {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const value = body.entry[0].changes[0].value;
            const msgObj = value.messages[0];
            const from = msgObj.from;
            const contactName = value.contacts && value.contacts[0] ? (value.contacts[0].profile.name || 'Cliente') : 'Cliente';
            const phoneId = value.metadata.phone_number_id;

            let accountId = 'principal';
            if (phoneId === process.env.META_PHONE_ID) {
                accountId = 'principal';
            }

            const msgText = msgObj.type === 'text' ? msgObj.text.body :
                            (msgObj.type === 'interactive' && msgObj.interactive?.type === 'button_reply') ? msgObj.interactive.button_reply.id : '';

            if (msgText) {
                handleUnifiedMessage(accountId, from, contactName, msgText, 'meta').catch(err => {
                    console.error('[MetaWebhook] Error al procesar mensaje unificado:', err);
                });
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};

const saveMessage = async (leadId, emisor, texto, cuenta, tipo = 'text') => {
    try {
        await query(
            'INSERT INTO mensajes (lead_id, emisor, texto, cuenta, tipo) VALUES ($1, $2, $3, $4, $5)',
            [leadId, emisor, texto, cuenta, tipo]
        );
        const socketService = require('../services/socketService');
        socketService.emitToRoom(`lead_${leadId}`, 'new_message', {
            lead_id: leadId,
            emisor,
            texto,
            cuenta,
            tipo,
            fecha: new Date().toISOString()
        });
        socketService.emitToAll('lead_updated', { lead_id: leadId });
    } catch (err) {
        console.error(`[saveMessage] Error al guardar mensaje: ${err.message}`);
    }
};

const handleUnifiedMessage = async (accountId, jid, contactName, msgText, deliveryMethod, msgType = 'text', isFromMe = false) => {
    global.botLogs = global.botLogs || [];
    const log = (text) => {
        const entry = `[${new Date().toISOString()}] [${accountId}:${deliveryMethod}] ${text}`;
        console.log(entry);
        global.botLogs.push(entry);
        if (global.botLogs.length > 500) global.botLogs.shift();
    };

    const from = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
    log(`Mensaje entrante de ${from} (${contactName}): "${msgText}"`);

    if (!msgText) {
        log(`Mensaje ignorado: no contiene texto`);
        return;
    }

    try {
        if (isFromMe) {
            if (msgText.includes('Hemos registrado tu solicitud') || msgText.includes('un asesor de MIT Medical Tower')) {
                log(`Mensaje saliente de seguimiento automático detectado en isFromMe. Ignorando.`);
                return;
            }

            log(`Buscando lead para mensaje saliente de ${from} (JID: ${jid})...`);
            let [rows] = await query('SELECT * FROM leads WHERE telefono = $1 OR telefono = $2', [jid, from]);
            if (rows.length === 0) {
                log(`Mensaje saliente para un número que no es lead. Ignorando.`);
                return;
            }
            const lead = rows[0];
            log(`Mensaje enviado desde el teléfono del agente para el lead ID=${lead.id}. Guardando en el CRM.`);

            await query(
                "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'HUMANO', step_estado = 99, estado_atencion = 'EN_CURSO', fecha_actualizacion = NOW() WHERE id = $2",
                [msgText, lead.id]
            );

            await saveMessage(lead.id, 'HUMANO', msgText, accountId, msgType);
            return;
        }

        log(`Buscando lead para ${from} (JID: ${jid})...`);
        let [rows] = await query('SELECT * FROM leads WHERE telefono = $1 OR telefono = $2', [jid, from]);
        let lead;
        let isNewInteraction = false;

        if (rows.length === 0) {
            log(`Lead nuevo. Creando en la BD...`);
            const [result] = await query(
                "INSERT INTO leads (nombre, telefono, ultimo_mensaje, ultimo_emisor, cuenta, step_estado, estado_atencion) VALUES ($1, $2, $3, 'CLIENTE', $4, 0, 'PENDIENTE') RETURNING *",
                [contactName, jid, msgText, accountId]
            );
            lead = result[0];
            log(`Lead nuevo creado con ID: ${lead.id}`);
            isNewInteraction = true;
        } else {
            lead = rows[0];
            log(`Lead existente: ID=${lead.id}, step=${lead.step_estado}, estado_atencion=${lead.estado_atencion}, cuenta=${lead.cuenta}, vendedor_id=${lead.vendedor_id}`);

            if (!lead.telefono.includes('@')) {
                log(`Migrando teléfono de lead ID=${lead.id} a JID completo: ${jid}`);
                await query('UPDATE leads SET telefono = $1 WHERE id = $2', [jid, lead.id]);
                lead.telefono = jid;
            }

            const leadCuenta = lead.cuenta || 'principal';
            if (leadCuenta !== accountId) {
                log(`Cambio de marca detectado: del lead (${leadCuenta}) al canal actual (${accountId}). Reiniciando lead.`);
                lead.step_estado = 0;
                lead.estado_atencion = 'PENDIENTE';
                lead.vendedor_id = null;
                lead.tags = '';
                lead.cuenta = accountId;

                await query(
                    "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', estado_atencion = 'PENDIENTE', cuenta = $2, step_estado = 0, vendedor_id = NULL, tags = NULL, fecha_actualizacion = NOW() WHERE id = $3",
                    [msgText, accountId, lead.id]
                );
            }
        }

        // PROTECCION: si un humano ya intervino, bot se silencia
        const [humanMessages] = await query(
            "SELECT 1 FROM mensajes WHERE lead_id = $1 AND emisor = 'HUMANO' LIMIT 1",
            [lead.id]
        );
        const hasHumanSpoken = humanMessages.length > 0;
        const isHumanIntervened = hasHumanSpoken || lead.step_estado === 99 || (lead.estado_atencion || '') === 'EN_CURSO' || !!lead.vendedor_id;

        if (isHumanIntervened) {
            log(`Lead ID=${lead.id} ya intervenido por humano. Bot silenciado.`);

            const targetEstado = lead.estado_atencion === 'EN_CURSO' ? 'EN_CURSO' : 'PENDIENTE';
            await query(
                "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', step_estado = 99, estado_atencion = $2, fecha_actualizacion = NOW() WHERE id = $3",
                [msgText, targetEstado, lead.id]
            );
            await saveMessage(lead.id, 'CLIENTE', msgText, accountId, msgType);
            return;
        }

        await query(
            "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', estado_atencion = 'PENDIENTE', cuenta = $2, fecha_actualizacion = NOW() WHERE id = $3",
            [msgText, accountId, lead.id]
        );
        await saveMessage(lead.id, 'CLIENTE', msgText, accountId, msgType);

        const [outgoing] = await query(
            "SELECT id FROM mensajes WHERE lead_id = $1 AND emisor IN ('BOT', 'HUMANO') LIMIT 1",
            [lead.id]
        );
        const isFirstInteraction = isNewInteraction || outgoing.length === 0;

        let step = lead.step_estado || 0;
        const brandName = features.BRAND_NAME;
        let tags = lead.tags || '';

        log(`Consultando configuración del bot de la BD...`);
        let flowConfig = null;
        try {
            const [settings] = await query("SELECT value FROM bot_settings WHERE key = 'flow_config'");
            if (settings.length > 0) {
                flowConfig = settings[0].value;
                if (typeof flowConfig === 'string') {
                    try { flowConfig = JSON.parse(flowConfig); } catch(e) {}
                }
            }
        } catch (dbErr) {
            log(`Error al cargar configuración de flujo: ${dbErr.message}`);
        }

        if (!flowConfig || !flowConfig.enabled) {
            log(`Bot desactivado. Ignorando.`);
            return;
        }

        const accountKey = `enabled_${accountId}`;
        if (flowConfig[accountKey] === false) {
            log(`Bot desactivado para cuenta ${accountId}. Ignorando.`);
            return;
        }

        const cleanMsg = msgText.trim().toLowerCase();
        log(`Procesando mensaje limpio: "${cleanMsg}" en step ${step}`);

        // ─── Helpers de envío ───
        const send = async (text) => {
            log(`Enviando: "${text.substring(0, 80)}..."`);
            if (deliveryMethod === 'meta') {
                await sendMetaMessage(accountId, from, text);
            } else {
                await whatsappService.sendMessage(accountId, jid, text);
            }
            await saveMessage(lead.id, 'BOT', text, accountId, 'text');
        };

        const sendMenu = async (text, opts) => {
            log(`Enviando menú: "${text.substring(0, 60)}..." opts=${opts.length}`);
            let buttonText = '';
            if (deliveryMethod === 'meta' && opts.length <= 3) {
                const metaButtons = opts.map(opt => {
                    let cleanTitle = opt.title.replace(/^\d+[\s.-]+/, '');
                    if (cleanTitle.length > 20) cleanTitle = cleanTitle.substring(0, 17) + '...';
                    return { type: 'reply', reply: { id: opt.id, title: cleanTitle } };
                });
                await sendMetaMessage(accountId, from, text, metaButtons);
                buttonText = opts.map((opt, i) => `${i + 1}. ${opt.title.replace(/^\d+[\s.-]+/, '')}`).join('\n');
            } else if (deliveryMethod === 'meta') {
                const cleanOpts = opts.map(opt => ({ ...opt, title: opt.title.replace(/^\d+[\s.-]+/, '') }));
                buttonText = cleanOpts.map((opt, i) => `${i + 1}. ${opt.title}`).join('\n');
                await sendMetaMessage(accountId, from, `${text}\n\n${buttonText}`);
            } else {
                await whatsappService.sendButtons(accountId, jid, text, opts);
                buttonText = opts.map((opt, i) => `${i + 1}. ${opt.title.replace(/^\d+[\s.-]+/, '')}`).join('\n');
            }
            await saveMessage(lead.id, 'BOT', `${text}\n\n${buttonText}`, accountId, 'text');
        };

        const updateStep = async (newStep, newTag = null) => {
            const finalTags = newTag ? (tags ? `${tags}, ${newTag}` : newTag) : tags;
            await query(
                "UPDATE leads SET step_estado = $1, tags = $2, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $3",
                [newStep, finalTags, lead.id]
            );
            tags = finalTags;
        };

        const escalateToHuman = async (tag) => {
            const finalTags = tag ? (tags ? `${tags}, ${tag}` : tag) : tags;
            await query(
                "UPDATE leads SET step_estado = 99, estado_atencion = 'PENDIENTE', tags = $1, cuenta = $2, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $3",
                [finalTags, accountId, lead.id]
            );
            log(`Lead ID=${lead.id} escalado a humano. Tag=${tag}. Step=99.`);
        };

        // ─── Detección de intención global ───
        const greetings = ['hola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes', 'buenas noches', 'hello', 'hi', 'inicio', 'comenzar', 'start'];
        const isGreeting = greetings.includes(cleanMsg);
        const wantsMenu = cleanMsg === 'menu' || cleanMsg === 'menú' || cleanMsg === 'volver' || cleanMsg === 'inicio' || cleanMsg === '0';

        // ═══════════════════════════════════════
        //  MENÚ PRINCIPAL — Step 1
        // ═══════════════════════════════════════
        const sendMainMenu = async () => {
            const menuText = `¡Hola! 👋 Bienvenido(a) a *${brandName}* 🏥\nSoy tu asistente virtual. ¿En qué podemos ayudarte?\n\nEscribe el *número* de la opción:\n\n1️⃣ Agendar cita médica\n2️⃣ Ver especialidades\n3️⃣ Cirugía plástica y precios\n4️⃣ Laboratorio y estudios\n5️⃣ Sueros Raimalab 💉\n6️⃣ Ubicación y horarios\n7️⃣ Hablar con un asesor`;
            await send(menuText);
            await updateStep(1);
        };

        // ═══════════════════════════════════════
        //  STEP 10 — AGENDAR CITA: Elegir especialidad
        // ═══════════════════════════════════════
        const sendSpecialtyPicker = async () => {
            let text = `📅 *Agendar cita médica*\n\n¿Con qué especialista deseas tu cita? Escribe el *número*:\n\n`;
            ESPECIALIDADES.forEach((esp, i) => {
                text += `${i + 1}. ${esp.emoji} ${esp.nombre}\n`;
            });
            text += `\n0️⃣ Volver al menú principal`;
            await send(text);
            await updateStep(10, 'AGENDAR_CITA');
        };

        // ═══════════════════════════════════════
        //  STEP 20 — VER ESPECIALIDADES (lista)
        // ═══════════════════════════════════════
        const sendSpecialtyList = async () => {
            let text = `🩺 *Nuestras especialidades*\n\nEscribe el *número* para ver más detalle:\n\n`;
            ESPECIALIDADES.forEach((esp, i) => {
                text += `${i + 1}. ${esp.emoji} ${esp.nombre}\n`;
            });
            text += `\n0️⃣ Volver al menú principal`;
            await send(text);
            await updateStep(20, 'INFO_ESPECIALIDADES');
        };

        // ═══════════════════════════════════════
        //  STEP 30 — CIRUGÍA PLÁSTICA Y PRECIOS
        // ═══════════════════════════════════════
        const sendCirugiaPrices = async () => {
            let text = `✨ *Cirugía Plástica — Precios*\n\n`;
            CIRUGIAS_PRECIOS.forEach(c => {
                text += `• *${c.nombre}:* ${c.precio}\n`;
            });
            text += `\n_Incluye: valoración, quirófano equipado con tecnología Prázise, anestesia y seguimiento postoperatorio._\n\n¿Te interesa algún procedimiento?\n\n1️⃣ Agendar valoración de cirugía plástica\n2️⃣ Hablar con un asesor\n0️⃣ Volver al menú principal`;
            await send(text);
            await updateStep(30, 'CIRUGIA_PLASTICA');
        };

        // ═══════════════════════════════════════
        //  STEP 40 — LABORATORIO Y ESTUDIOS
        // ═══════════════════════════════════════
        const sendLabInfo = async () => {
            let text = `🔬 *Laboratorio y estudios diagnósticos*\n\n`;
            SERVICIOS_DIAGNOSTICO.forEach(s => {
                text += `• *${s.nombre}:* ${s.desc}\n`;
            });
            text += `\n🏥 Contamos con quirófano, sala de esterilización, máquina de anestesia y desfibrilador.\n\n¿Qué deseas hacer?\n\n1️⃣ Agendar estudio/laboratorio\n2️⃣ Preguntar disponibilidad y costos\n0️⃣ Volver al menú principal`;
            await send(text);
            await updateStep(40, 'LABORATORIO');
        };

        // ═══════════════════════════════════════
        //  ROUTER PRINCIPAL
        // ═══════════════════════════════════════

        // Volver al menú desde cualquier step
        if (wantsMenu && step > 0) {
            await sendMainMenu();
            return;
        }

        // Primera interacción o saludo → menú principal
        if (isFirstInteraction || isGreeting || step === 0) {
            const directMatch = matchDirectIntent(cleanMsg);
            if (!isGreeting && directMatch) {
                step = 1; // simular que está en menú
            } else {
                await sendMainMenu();
                return;
            }
        }

        // ─── STEP 1: Menú principal ───
        if (step === 1) {
            const choice = matchMainMenuOption(cleanMsg);

            switch (choice) {
                case 1: // Agendar cita
                    await sendSpecialtyPicker();
                    return;

                case 2: // Ver especialidades
                    await sendSpecialtyList();
                    return;

                case 3: // Cirugía plástica y precios
                    await sendCirugiaPrices();
                    return;

                case 4: // Laboratorio
                    await sendLabInfo();
                    return;

                case 5: // Sueros Raimalab
                    await send(INFO_SUEROS);
                    await updateStep(50, 'SUEROS_RAIMALAB');
                    return;

                case 6: // Ubicación y horarios
                    await send(INFO_UBICACION);
                    await send(`¿Necesitas algo más?\n\n1️⃣ Agendar cita\n2️⃣ Ver especialidades\n0️⃣ Volver al menú`);
                    await updateStep(60, 'UBICACION');
                    return;

                case 7: // Hablar con asesor
                    await send(`👤 ¡Entendido! Te transferiremos con un asesor de *${brandName}* en este momento.\n\nPor favor espera un momento mientras te asignamos. ¡Gracias por contactarnos!`);
                    await escalateToHuman('HABLAR_ASESOR');
                    return;

                default:
                    await send(`No entendí tu respuesta. Por favor escribe el *número* de la opción (1-7) o escribe *"menú"* para ver las opciones de nuevo.`);
                    return;
            }
        }

        // ─── STEP 10: Agendar cita — selección de especialidad ───
        if (step === 10) {
            const idx = parseSpecialtyChoice(cleanMsg);
            if (idx !== null && idx >= 0 && idx < ESPECIALIDADES.length) {
                const esp = ESPECIALIDADES[idx];
                await send(`✅ *¡Perfecto!* Hemos registrado tu solicitud de cita en *${esp.emoji} ${esp.nombre}*.\n\nUn asesor de ${brandName} te contactará en breve por este chat para confirmar fecha y horario.\n\n📍 Recuerda: estamos en *Blvrd Prados de Aragón 8B*, Nezahualcóyotl.\n🕐 Lunes a Viernes, 9:00 am – 5:00 pm\n\n¡Gracias por confiar en nosotros! 🏥`);
                await escalateToHuman(`CITA_${esp.id.toUpperCase()}`);
                return;
            }
            await send(`Por favor escribe el *número* de la especialidad (1-${ESPECIALIDADES.length}) o *0* para volver al menú.`);
            return;
        }

        // ─── STEP 20: Ver especialidades — detalle ───
        if (step === 20) {
            const idx = parseSpecialtyChoice(cleanMsg);
            if (idx !== null && idx >= 0 && idx < ESPECIALIDADES.length) {
                const esp = ESPECIALIDADES[idx];
                await send(`${esp.emoji} *${esp.nombre}*\n\n*Esto incluye:*\n${esp.incluye.split(', ').map(i => `• ${i}`).join('\n')}\n\n¿Qué deseas hacer?\n\n1️⃣ Agendar cita en ${esp.nombre}\n2️⃣ Ver otra especialidad\n0️⃣ Volver al menú principal`);
                await updateStep(21);
                return;
            }
            await send(`Escribe el *número* de la especialidad (1-${ESPECIALIDADES.length}) o *0* para volver.`);
            return;
        }

        // ─── STEP 21: Detalle de especialidad — acción ───
        if (step === 21) {
            if (cleanMsg === '1' || cleanMsg.includes('agendar') || cleanMsg.includes('cita')) {
                await sendSpecialtyPicker();
                return;
            }
            if (cleanMsg === '2' || cleanMsg.includes('otra') || cleanMsg.includes('especialidad')) {
                await sendSpecialtyList();
                return;
            }
            await sendMainMenu();
            return;
        }

        // ─── STEP 30: Cirugía plástica — acción ───
        if (step === 30) {
            if (cleanMsg === '1' || cleanMsg.includes('agendar') || cleanMsg.includes('valoracion') || cleanMsg.includes('valoración')) {
                await send(`✅ *¡Excelente!* Hemos registrado tu interés en una *valoración de Cirugía Plástica*.\n\nUn asesor te contactará en breve para agendar tu consulta de valoración.\n\n📍 Blvrd Prados de Aragón 8B, Nezahualcóyotl\n🕐 Lunes a Viernes, 9:00 am – 5:00 pm\n\n¡Gracias! ✨`);
                await escalateToHuman('CITA_CIRUGIA_PLASTICA');
                return;
            }
            if (cleanMsg === '2' || cleanMsg.includes('asesor') || cleanMsg.includes('hablar')) {
                await send(`👤 ¡Entendido! Te transferiremos con un asesor para resolver tus dudas sobre *Cirugía Plástica*.\n\nUn momento por favor...`);
                await escalateToHuman('ASESOR_CIRUGIA_PLASTICA');
                return;
            }
            await sendMainMenu();
            return;
        }

        // ─── STEP 40: Laboratorio — acción ───
        if (step === 40) {
            if (cleanMsg === '1' || cleanMsg.includes('agendar') || cleanMsg.includes('estudio') || cleanMsg.includes('laboratorio')) {
                await send(`✅ *¡Listo!* Hemos registrado tu solicitud de *laboratorio/estudios diagnósticos*.\n\nUn asesor te contactará en breve para darte información sobre disponibilidad, preparación y costos.\n\n📍 Blvrd Prados de Aragón 8B, Nezahualcóyotl\n🕐 Lunes a Viernes, 9:00 am – 5:00 pm`);
                await escalateToHuman('CITA_LABORATORIO');
                return;
            }
            if (cleanMsg === '2' || cleanMsg.includes('costo') || cleanMsg.includes('precio') || cleanMsg.includes('disponibilidad')) {
                await send(`👤 ¡Entendido! Te transferiremos con un asesor que te informará sobre costos y disponibilidad de estudios.\n\nUn momento por favor...`);
                await escalateToHuman('INFO_LABORATORIO');
                return;
            }
            await sendMainMenu();
            return;
        }

        // ─── STEP 50: Sueros Raimalab — respuesta ───
        if (step === 50) {
            if (cleanMsg.includes('agendar') || cleanMsg === '1' || cleanMsg.includes('sesion') || cleanMsg.includes('sesión') || cleanMsg.includes('cita')) {
                await send(`✅ *¡Perfecto!* Hemos registrado tu interés en *Sueros Raimalab*.\n\nUn asesor te contactará para agendar tu sesión.\n\n💉 Suero Vita C desde $650 | Glutatión desde $850\n📍 Blvrd Prados de Aragón 8B, Nezahualcóyotl`);
                await escalateToHuman('CITA_SUEROS');
                return;
            }
            await sendMainMenu();
            return;
        }

        // ─── STEP 60: Ubicación — respuesta ───
        if (step === 60) {
            if (cleanMsg === '1' || cleanMsg.includes('agendar') || cleanMsg.includes('cita')) {
                await sendSpecialtyPicker();
                return;
            }
            if (cleanMsg === '2' || cleanMsg.includes('especialidad')) {
                await sendSpecialtyList();
                return;
            }
            await sendMainMenu();
            return;
        }

        // ─── Fallback: cualquier step desconocido ───
        await send(`¡Gracias por contactarnos! 🏥 Hemos registrado tu mensaje.\n\nEscribe *"menú"* para ver nuestras opciones, o un asesor de *${brandName}* te atenderá en breve.`);
        await escalateToHuman('CONSULTA_GENERAL');

    } catch (err) {
        log(`ERROR CRÍTICO procesando mensaje: ${err.message}\nStack: ${err.stack}`);
    }
};

// ─── Helpers de matching ───

function matchMainMenuOption(msg) {
    if (msg === '1' || msg.includes('agendar') || msg.includes('cita')) return 1;
    if (msg === '2' || msg.includes('especialidad')) return 2;
    if (msg === '3' || msg.includes('cirugia') || msg.includes('cirugía') || msg.includes('plastica') || msg.includes('plástica') || msg.includes('precio')) return 3;
    if (msg === '4' || msg.includes('laboratorio') || msg.includes('estudio') || msg.includes('analisis') || msg.includes('análisis') || msg.includes('sangre') || msg.includes('radiologia') || msg.includes('radiología') || msg.includes('ultrasonido') || msg.includes('ultrasonografía') || msg.includes('rayos')) return 4;
    if (msg === '5' || msg.includes('suero') || msg.includes('raimalab') || msg.includes('vita c') || msg.includes('glutati')) return 5;
    if (msg === '6' || msg.includes('ubicacion') || msg.includes('ubicación') || msg.includes('horario') || msg.includes('direccion') || msg.includes('dirección') || msg.includes('donde') || msg.includes('dónde') || msg.includes('mapa')) return 6;
    if (msg === '7' || msg.includes('asesor') || msg.includes('hablar') || msg.includes('persona') || msg.includes('humano') || msg.includes('otro')) return 7;
    return null;
}

function matchDirectIntent(msg) {
    return matchMainMenuOption(msg) !== null;
}

function parseSpecialtyChoice(msg) {
    const num = parseInt(msg, 10);
    if (!isNaN(num) && num >= 0 && num <= ESPECIALIDADES.length) {
        return num - 1; // -1 porque 0=volver, 1=primero
    }
    const lower = msg.toLowerCase();
    const idx = ESPECIALIDADES.findIndex(e =>
        lower.includes(e.id.replace('_', ' ')) ||
        lower.includes(e.nombre.toLowerCase()) ||
        (e.id === 'otorrino' && (lower.includes('otorrino') || lower.includes('oido') || lower.includes('oído') || lower.includes('garganta'))) ||
        (e.id === 'traumatologia' && (lower.includes('trauma') || lower.includes('ortopedia') || lower.includes('hueso') || lower.includes('fractura')))
    );
    return idx >= 0 ? idx : null;
}

// ═══════════════════════════════════════════════════════════════

const handleWhatsAppMessage = async (accountId, sock, msg) => {
    if (!msg.message || msg.message.protocolMessage) {
        return;
    }

    const jid = msg.key.remoteJid;
    const from = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
    const contactName = msg.pushName || 'Cliente';
    const isFromMe = msg.key.fromMe || false;

    let innerMessage = msg.message;

    if (innerMessage?.ephemeralMessage?.message) {
        innerMessage = innerMessage.ephemeralMessage.message;
    } else if (innerMessage?.viewOnceMessage?.message) {
        innerMessage = innerMessage.viewOnceMessage.message;
    } else if (innerMessage?.viewOnceMessageV2?.message?.imageMessage) {
        innerMessage = innerMessage.viewOnceMessageV2.message;
    } else if (innerMessage?.documentWithCaptionMessage?.message) {
        innerMessage = innerMessage.documentWithCaptionMessage.message;
    } else if (innerMessage?.editedMessage?.message) {
        innerMessage = innerMessage.editedMessage.message;
    }

    let msgText = msg.message?.conversation ||
                    innerMessage?.conversation ||
                    innerMessage?.extendedTextMessage?.text ||
                    innerMessage?.imageMessage?.caption ||
                    innerMessage?.videoMessage?.caption ||
                    innerMessage?.documentMessage?.caption ||
                    innerMessage?.buttonsResponseMessage?.selectedButtonId ||
                    innerMessage?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                    innerMessage?.templateButtonReplyMessage?.selectedId ||
                    innerMessage?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
                    '';

    let msgType = 'text';

    if (!msgText) {
        if (innerMessage?.documentMessage || innerMessage?.documentWithCaptionMessage) {
            msgText = '[Documento PDF adjunto]';
            msgType = 'document';
        } else if (innerMessage?.imageMessage) {
            msgText = '[Imagen adjunta]';
            msgType = 'image';
        } else if (innerMessage?.videoMessage) {
            msgText = '[Video adjunto]';
            msgType = 'video';
        } else if (innerMessage?.audioMessage) {
            msgText = '[Audio adjunto]';
            msgType = 'audio';
        }
    }

    if (msgType !== 'text') {
        try {
            const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                { },
                {
                    logger: console
                }
            );

            const extension = msgType === 'image' ? 'jpg' : msgType === 'video' ? 'mp4' : msgType === 'audio' ? 'ogg' : 'pdf';
            let originalFilename = '';
            if (msgType === 'document') {
                const docMessage = innerMessage?.documentMessage || innerMessage?.documentWithCaptionMessage?.message?.documentMessage;
                originalFilename = docMessage?.fileName ? `-${docMessage.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}` : '';
            }
            const filename = `media_${accountId}_${Date.now()}${originalFilename}.${extension}`;
            const filepath = path.join(uploadDir, filename);
            fs.writeFileSync(filepath, buffer);
            msgText = filename;
        } catch (err) {
            console.error('Error downloading media message:', err);
            msgText = `[Error al descargar ${msgType}]`;
            msgType = 'text';
        }
    }

    if (!msgText) return;
    if (jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.includes('broadcast')) {
        return;
    }

    handleUnifiedMessage(accountId, jid, contactName, msgText, 'baileys', msgType, isFromMe).catch(err => {
        console.error(`[Baileys:${accountId}] Error al procesar mensaje unificado:`, err);
    });
};

module.exports = {
    handleWebhookVerification,
    handleIncomingMessage,
    handleWhatsAppMessage,
    saveMessage
};
