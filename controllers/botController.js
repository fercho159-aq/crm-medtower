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
            // Ignorar si el mensaje saliente es del seguimiento automático del bot para evitar ecos
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

            // Actualizar último mensaje, emisor HUMANO, fijar step_estado = 99 y estado_atencion = 'EN_CURSO'
            await query(
                "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'HUMANO', step_estado = 99, estado_atencion = 'EN_CURSO', fecha_actualizacion = NOW() WHERE id = $2",
                [msgText, lead.id]
            );

            // Guardar mensaje en el historial y emitir por socket
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

            // Migrar en caliente el teléfono al JID completo si es necesario
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

        // PROTECCION ABSOLUTA CONTRA INTERRUPCIONES DEL BOT:
        // Si un humano ya envió algún mensaje a este lead en el historial de mensajes,
        // o si el lead ya está asignado a un vendedor (vendedor_id),
        // o si está en estado EN_CURSO, o ya se encuentra en step 99:
        // EL BOT PERMANECE COMPLETAMENTE EN SILENCIO.
        const [humanMessages] = await query(
            "SELECT 1 FROM mensajes WHERE lead_id = $1 AND emisor = 'HUMANO' LIMIT 1",
            [lead.id]
        );
        const hasHumanSpoken = humanMessages.length > 0;
        const isHumanIntervened = hasHumanSpoken || lead.step_estado === 99 || (lead.estado_atencion || '') === 'EN_CURSO' || !!lead.vendedor_id;

        if (isHumanIntervened) {
            log(`Lead ID=${lead.id} ya intervenido por humano o en step 99 (hasHuman=${hasHumanSpoken}, step=${lead.step_estado}, estado=${lead.estado_atencion}, vendedor=${lead.vendedor_id}). Bot silenciado permanentemente.`);

            const targetEstado = lead.estado_atencion === 'EN_CURSO' ? 'EN_CURSO' : 'PENDIENTE';
            await query(
                "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', step_estado = 99, estado_atencion = $2, fecha_actualizacion = NOW() WHERE id = $3",
                [msgText, targetEstado, lead.id]
            );

            // Guardar mensaje recibido en el historial para el CRM
            await saveMessage(lead.id, 'CLIENTE', msgText, accountId, msgType);
            return;
        }

        // Si aún no ha sido intervenido por un humano, registrar mensaje entrante
        await query(
            "UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', estado_atencion = 'PENDIENTE', cuenta = $2, fecha_actualizacion = NOW() WHERE id = $3",
            [msgText, accountId, lead.id]
        );
        await saveMessage(lead.id, 'CLIENTE', msgText, accountId, msgType);

        // Verificar si es la primera vez que interactuamos
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

        // Check if bot is enabled for this specific account
        const accountKey = `enabled_${accountId}`;
        if (flowConfig[accountKey] === false) {
            log(`Bot desactivado para cuenta ${accountId}. Ignorando.`);
            return;
        }

        const cleanMsg = msgText.trim().toLowerCase();
        log(`Procesando mensaje limpio: "${cleanMsg}" en step ${step}`);

        const send = async (text) => {
            log(`Enviando mensaje de texto a ${from}: "${text.substring(0, 60)}..."`);
            if (deliveryMethod === 'meta') {
                await sendMetaMessage(accountId, from, text);
            } else {
                await whatsappService.sendMessage(accountId, jid, text);
            }
            await saveMessage(lead.id, 'BOT', text, accountId, 'text');
        };

        const sendMenu = async (text, opts) => {
            log(`Enviando menú interactivo a ${from}: "${text.substring(0, 60)}..." con opciones: ${JSON.stringify(opts)}`);
            let buttonText = '';
            if (deliveryMethod === 'meta' && opts.length <= 3) {
                const metaButtons = opts.map(opt => {
                    let cleanTitle = opt.title.replace(/^\d+[\s.-]+/, '');
                    if (cleanTitle.length > 20) {
                        cleanTitle = cleanTitle.substring(0, 17) + '...';
                    }
                    return {
                        type: 'reply',
                        reply: {
                            id: opt.id,
                            title: cleanTitle
                        }
                    };
                });
                await sendMetaMessage(accountId, from, text, metaButtons);
                buttonText = opts.map((opt, i) => `${i + 1}. ${opt.title.replace(/^\d+[\s.-]+/, '')}`).join('\n');
            } else if (deliveryMethod === 'meta') {
                const cleanOpts = opts.map(opt => ({
                    ...opt,
                    title: opt.title.replace(/^\d+[\s.-]+/, '')
                }));
                buttonText = cleanOpts.map((opt, i) => `${i + 1}. ${opt.title}`).join('\n');
                await sendMetaMessage(accountId, from, `${text}\n\n${buttonText}`);
            } else {
                await whatsappService.sendButtons(accountId, jid, text, opts);
                buttonText = opts.map((opt, i) => `${i + 1}. ${opt.title.replace(/^\d+[\s.-]+/, '')}`).join('\n');
            }
            await saveMessage(lead.id, 'BOT', `${text}\n\n${buttonText}`, accountId, 'text');
        };

        // === MIT Medical Tower Flow ===
        const greetings = ['hola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes', 'buenas noches', 'hello', 'hi', 'inicio', 'comenzar', 'start'];
        const isGreeting = greetings.includes(cleanMsg);

        const sendMainMenu = async () => {
            const menuText = flowConfig.menu_principal_mensaje || `¡Hola! Bienvenido(a) a ${brandName}. 🏥 Soy tu asistente virtual. ¿En qué podemos ayudarte?\n\nSelecciona una opción:\n1. Agendar cita médica 📅\n2. Información de especialidades 🩺\n3. Laboratorio y estudios 🔬\n4. Hablar con un asesor 👤`;
            await sendMenu(menuText, [
                { id: '1', title: '1. Agendar cita 📅' },
                { id: '2', title: '2. Especialidades 🩺' },
                { id: '3', title: '3. Laboratorio 🔬' },
                { id: '4', title: '4. Hablar con asesor 👤' }
            ]);
            await query("UPDATE leads SET step_estado = 1, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $1", [lead.id]);
        };

        if (isFirstInteraction || isGreeting || step === 0) {
            // Check if they directly chose an option
            const isAgendarDirect = cleanMsg === '1' || cleanMsg.includes('agendar') || cleanMsg.includes('cita');
            const isInfoDirect = cleanMsg === '2' || cleanMsg.includes('especialidad') || cleanMsg.includes('informacion') || cleanMsg.includes('información') || cleanMsg.includes('servicio');
            const isLabDirect = cleanMsg === '3' || cleanMsg.includes('laboratorio') || cleanMsg.includes('estudio') || cleanMsg.includes('analisis') || cleanMsg.includes('análisis');
            const isAsesorDirect = cleanMsg === '4' || cleanMsg.includes('asesor') || cleanMsg.includes('hablar') || cleanMsg.includes('persona');

            if (!isGreeting && (isAgendarDirect || isInfoDirect || isLabDirect || isAsesorDirect)) {
                // Fall through to process below
            } else {
                await sendMainMenu();
                return;
            }
        }

        // Process menu selection
        const isAgendar = cleanMsg === '1' || cleanMsg.includes('agendar') || cleanMsg.includes('cita') || cleanMsg.includes('consulta');
        const isInfo = cleanMsg === '2' || cleanMsg.includes('especialidad') || cleanMsg.includes('informacion') || cleanMsg.includes('información') || cleanMsg.includes('servicio');
        const isLab = cleanMsg === '3' || cleanMsg.includes('laboratorio') || cleanMsg.includes('estudio') || cleanMsg.includes('analisis') || cleanMsg.includes('análisis') || cleanMsg.includes('sangre');
        const isAsesor = cleanMsg === '4' || cleanMsg.includes('asesor') || cleanMsg.includes('hablar') || cleanMsg.includes('persona') || cleanMsg.includes('otro');

        let respuesta = '';
        let newTag = '';

        if (isAgendar) {
            newTag = 'AGENDAR_CITA';
            respuesta = flowConfig.agendar_mensaje || `¡Gracias por tu interés! 📅 Hemos registrado tu solicitud de cita. En breve, uno de nuestros asesores te contactará por este chat para agendar tu consulta con el especialista adecuado. ¡Un momento por favor!`;
        } else if (isInfo) {
            newTag = 'INFO_ESPECIALIDADES';
            respuesta = flowConfig.info_mensaje || `¡Gracias por tu interés! 🩺 En ${brandName} contamos con más de 15 especialidades médicas, laboratorio, radiología y ultrasonografía. Un asesor te brindará información detallada en un momento. ¡Espera por favor!`;
        } else if (isLab) {
            newTag = 'LABORATORIO';
            respuesta = flowConfig.laboratorio_mensaje || `¡Gracias! 🔬 Hemos registrado tu consulta sobre laboratorio y estudios. Un asesor te contactará para darte información sobre disponibilidad, preparación y costos. ¡Un momento por favor!`;
        } else if (isAsesor) {
            newTag = 'HABLAR_ASESOR';
            respuesta = flowConfig.asesor_mensaje || `¡Entendido! 👤 Te transferiremos con un asesor en este momento. Por favor espera un momento mientras te asignamos. ¡Gracias por contactar a ${brandName}!`;
        } else {
            newTag = 'CONSULTA_GENERAL';
            respuesta = `¡Gracias por contactarnos! 🏥 Hemos registrado tu mensaje. En breve, un asesor de ${brandName} te atenderá por este chat. ¡Un momento por favor!`;
        }

        await send(respuesta);

        const finalTags = tags ? `${tags}, ${newTag}` : newTag;
        await query(
            "UPDATE leads SET step_estado = 99, estado_atencion = 'PENDIENTE', tags = $1, cuenta = $2, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $3",
            [finalTags, accountId, lead.id]
        );
        log(`Lead ID=${lead.id} clasificado. Tag=${newTag}. Step=99, estado=PENDIENTE. Bot finalizado.`);
        return;

    } catch (err) {
        log(`ERROR CRÍTICO procesando mensaje: ${err.message}\nStack: ${err.stack}`);
    }
};

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
            // Extract original filename if document
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
