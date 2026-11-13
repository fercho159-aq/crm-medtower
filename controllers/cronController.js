const { query } = require('../config/db');
const whatsappService = require('../services/whatsappService');
const features = require('../config/features');

function normalizePhoneNumber(phone) {
    let clean = String(phone).replace(/[^0-9]/g, '');
    if (clean.length === 10) {
        clean = '52' + clean; // Mexico country code
    }
    return clean;
}

// Equipo que recibe los avisos de Parrilla / Historias.
// Se lee de la variable de entorno CRM_TEAM_RECIPIENTS (formato: "Nombre:Telefono,Nombre2:Telefono2")
// Si no está definida, se usa un destinatario por defecto (Admin).
const parseTeamRecipients = () => {
    const envVal = process.env.CRM_TEAM_RECIPIENTS;
    if (!envVal) return [{ name: 'Admin', phone: '525528380715' }];
    return envVal.split(',').map(entry => {
        const [name, phone] = entry.trim().split(':');
        return { name: name || 'Equipo', phone: normalizePhoneNumber(phone || '') };
    }).filter(r => r.phone);
};

const TEAM_RECIPIENTS = parseTeamRecipients();

// Devuelve [{ name, phone }]. PARRILLA_NOTIFICATION_PHONES (opcional) AGREGA números extra; ya no reemplaza al equipo.
const getNotificationRecipientsDetailed = () => {
    const list = TEAM_RECIPIENTS.map(r => ({ ...r }));
    const envPhones = process.env.PARRILLA_NOTIFICATION_PHONES;
    if (envPhones) {
        envPhones.split(',').map(p => normalizePhoneNumber(p)).filter(Boolean).forEach(p => {
            if (!list.some(r => r.phone === p)) list.push({ name: `Extra ${p}`, phone: p });
        });
    }
    return list;
};

const getNotificationRecipients = () => getNotificationRecipientsDetailed().map(r => r.phone);

// Envía un mismo mensaje a todo el equipo, verificando cada número y guardando un reporte de entrega.
async function sendToTeam(connectedAcc, image, caption, logTag) {
    const recipients = getNotificationRecipientsDetailed();
    const report = [];
    let sentCount = 0;

    for (const r of recipients) {
        const entry = { name: r.name, phone: r.phone, ok: false, detail: '' };
        try {
            const check = await whatsappService.checkNumber(connectedAcc, r.phone);
            if (check.isSelf) {
                entry.detail = 'Es el MISMO número del WhatsApp vinculado al CRM: el mensaje cae en "Mensaje a ti mismo" y no genera notificación.';
            }
            if (check.exists === false) {
                entry.detail = 'Este número no aparece registrado en WhatsApp (o está mal escrito).';
                report.push(entry);
                console.error(`[${logTag}] ❌ ${r.name} (${r.phone}): número no registrado en WhatsApp`);
                continue;
            }
            const sent = await whatsappService.sendMediaMessage(connectedAcc, check.jid || r.phone, image, caption);
            entry.ok = true;
            entry.messageId = sent && sent.key ? sent.key.id : null;
            entry.jid = check.jid || null;
            sentCount++;
            console.log(`[${logTag}] ✅ ${r.name} (${r.phone}) jid=${check.jid || 'n/a'}${check.isSelf ? ' [SELF]' : ''}`);
        } catch (err) {
            entry.detail = err.message;
            console.error(`[${logTag}] ❌ ${r.name} (${r.phone}):`, err.message);
        }
        report.push(entry);
    }

    try {
        await query(
            `INSERT INTO bot_settings (key, value) VALUES ('last_team_delivery_report', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify({ at: new Date().toISOString(), tag: logTag, account: connectedAcc, report })]
        );
    } catch (e) {}

    return { sentCount, total: recipients.length, report };
}

function formatParrillaNotification(card) {
    const pubDate = card.publish_date ? new Date(card.publish_date) : new Date();
    const timeStr = pubDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = pubDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

    let msg = `📢 *¡RECORDATORIO DE PUBLICACIÓN HOY!* 🚀\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📌 *Título:* ${card.title || 'Sin Título'}\n`;
    if (card.social_networks) msg += `🌐 *Redes Sociales:* ${card.social_networks}\n`;
    if (card.funnel_stage) msg += `🎯 *Etapa Funnel:* ${card.funnel_stage}\n`;
    if (card.tags) msg += `📚 *Pilar de Contenido:* ${card.tags}\n`;
    if (card.content_type) msg += `🎬 *Formato:* ${card.content_type}\n`;
    if (card.priority && card.priority !== 'Normal') msg += `⚡ *Prioridad:* ${card.priority}\n`;
    if (card.status) msg += `🏷️ *Fase actual:* ${card.status}\n`;
    if (card.assigned_to) msg += `👤 *Asignado a:* ${card.assigned_to}\n`;
    msg += `⏰ *Hora Programada:* ${timeStr} (${dateStr})\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (card.description && card.description.trim()) {
        msg += `📝 *COPY / GUION:*\n${card.description.trim()}\n\n`;
    }

    if (card.reference_url) {
        msg += `🔗 *Referencia / Ejemplo:*\n${card.reference_url}\n`;
    }
    if (card.media_url) {
        msg += `📁 *Carpeta / Arte Final:*\n${card.media_url}\n`;
    }

    msg += `\n⚡ _CRM ${features.BRAND_NAME}_`;
    return msg;
}

async function sendCardNotificationToTeam(card) {
    const recipients = getNotificationRecipients();
    const caption = formatParrillaNotification(card);
    const image = card.cover_image_url || null;
    const connectedAcc = whatsappService.getConnectedAccount();

    if (!connectedAcc) {
        return {
            sentCount: 0,
            total: recipients.length,
            recipients,
            whatsappConnected: false,
            formattedMessage: caption,
            errors: [{ error: 'Ninguna línea de WhatsApp está conectada en el servidor (QR pendiente)' }]
        };
    }

    const { sentCount, total, report } = await sendToTeam(connectedAcc, image, caption, `Parrilla Notify #${card.id || 'temp'}`);
    const errors = report.filter(r => !r.ok).map(r => ({ phone: r.phone, name: r.name, error: r.detail }));
    return {
        sentCount,
        total,
        recipients,
        whatsappConnected: true,
        formattedMessage: caption,
        report,
        errors
    };
}

const runFollowUp = async (req, res) => {
    try {
        const sql = `
            SELECT id, telefono, nombre
            FROM leads
            WHERE ultimo_emisor = 'BOT'
            AND estado_atencion != 'RESUELTO'
            AND fecha_actualizacion <= NOW() - INTERVAL '2 hours'
        `;

        const [yellowAlerts] = await query(sql);

        let count = 0;
        for (const lead of yellowAlerts) {
            const message = `¡Hola ${lead.nombre}! Te escribimos de ${features.BRAND_NAME}. ¿Sigues interesado(a) en agendar una consulta? Estamos aquí para ayudarte. 🏥`;
            const cleanPhone = lead.telefono.replace('@s.whatsapp.net', '');
            try {
                await whatsappService.sendMessage('principal', cleanPhone, message);
                await query('UPDATE leads SET ultimo_emisor = $1, estado_atencion = $2 WHERE id = $3', ['BOT', 'PENDIENTE', lead.id]);
                count++;
            } catch (err) {
                console.error(`Error follow-up for lead ${lead.id}:`, err.message);
            }
        }

        if (res) res.json({ success: true, message: `Follow-up ejecutado. Mensajes enviados: ${count}` });
        return { count };
    } catch (error) {
        console.error('Error in follow-up cron job:', error);
        if (res) res.status(500).json({ error: 'Failed to run follow-up job' });
    }
};

function getLocalDateParts() {
    const tz = features.BRAND_TIMEZONE;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return {
        now,
        dateISO: `${y}-${m}-${d}`,
        hour: now.getHours(),
        dateReadable: now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    };
}

function formatDailyStoriesNotification(scheduledToday = []) {
    const { dateReadable } = getLocalDateParts();

    let msg = `📲 *¡AVISO DIARIO: CONTENIDO EN REDES SOCIALES!* 🔥\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 *Fecha:* ${dateReadable}\n`;
    msg += `📱 *Marca:* ${features.BRAND_NAME}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `✅ *TAREAS DIARIAS DE CONTENIDO:*\n`;
    msg += `1️⃣ *Publicar contenido programado del día.*\n`;
    msg += `2️⃣ *Subir historias en redes sociales.*\n`;
    msg += `3️⃣ *Revisar interacciones y responder comentarios.*\n\n`;

    if (scheduledToday && scheduledToday.length > 0) {
        msg += `📌 *PUBLICACIONES DEL CALENDARIO PARA HOY (${scheduledToday.length}):*\n`;
        scheduledToday.forEach((c, idx) => {
            msg += `   • ${idx + 1}. *${c.title}* (${c.content_type || 'Post'} — Paso: ${c.status || 'Pendiente'})\n`;
        });
        msg += `\n`;
    }

    msg += `\n⚡ _Recordatorio Diario Automático • CRM ${features.BRAND_NAME}_`;
    return msg;
}

let isProcessingParrillaQueue = false;

async function sendDailyStoriesNotification(queueIfDisconnected = true) {
    const { dateISO } = getLocalDateParts();
    let scheduledToday = [];
    try {
        const [rows] = await query(`
            SELECT title, content_type, status
            FROM parrilla_cards
            WHERE deleted_at IS NULL
            AND publish_date IS NOT NULL
            AND TO_CHAR(publish_date, 'YYYY-MM-DD') = $1
        `, [dateISO]);
        scheduledToday = rows || [];
    } catch (e) {}

    const recipients = getNotificationRecipients();
    const caption = formatDailyStoriesNotification(scheduledToday);
    const connectedAcc = whatsappService.getConnectedAccount();

    if (!connectedAcc) {
        if (queueIfDisconnected) {
            try {
                const [settingRows] = await query("SELECT value FROM bot_settings WHERE key = 'daily_stories_reminder'");
                const prev = (settingRows.length > 0 && settingRows[0].value) ? settingRows[0].value : {};
                const val = JSON.stringify({
                    ...prev,
                    pending_retry: true,
                    pending_date: dateISO,
                    queued_at: new Date().toISOString()
                });
                await query(
                    `INSERT INTO bot_settings (key, value) VALUES ('daily_stories_reminder', $1)
                     ON CONFLICT (key) DO UPDATE SET value = $1`,
                    [val]
                );
                console.log(`[Stories Daily Cola] ⏳ WhatsApp sin conexión. Aviso diario de contenido quedó EN COLA para enviarse apenas conecte o en el próximo reintento de 30 min.`);
            } catch (qErr) {}
        }
        return {
            sentCount: 0,
            total: recipients.length,
            recipients,
            whatsappConnected: false,
            queuedForRetry: true,
            formattedMessage: caption,
            errors: [{ error: 'WhatsApp desconectado — Aviso guardado en cola automática (se enviará apenas conecte o en el reintento cada 30 min)' }]
        };
    }

    const { sentCount, report } = await sendToTeam(connectedAcc, null, caption, 'Stories Daily Notify');
    const errors = report.filter(r => !r.ok).map(r => ({ phone: r.phone, name: r.name, error: r.detail }));

    if (sentCount > 0) {
        try {
            const val = JSON.stringify({
                last_sent_date: dateISO,
                pending_retry: false,
                sent_at: new Date().toISOString()
            });
            await query(
                `INSERT INTO bot_settings (key, value) VALUES ('daily_stories_reminder', $1)
                 ON CONFLICT (key) DO UPDATE SET value = $1`,
                [val]
            );
        } catch (dbErr) {
            console.error('[Stories Daily Notify] Error guardando estado diario:', dbErr.message);
        }
    }

    return {
        sentCount,
        total: recipients.length,
        recipients,
        whatsappConnected: true,
        queuedForRetry: sentCount === 0,
        formattedMessage: caption,
        errors
    };
}

const checkParrillaReminders = async (req, res) => {
    if (isProcessingParrillaQueue) {
        if (res) return res.json({ success: true, message: 'Cola de avisos ya en proceso.' });
        return { skipped: true };
    }
    isProcessingParrillaQueue = true;

    try {
        const { dateISO, hour } = getLocalDateParts();
        const connectedAcc = whatsappService.getConnectedAccount();

        // 1. Aviso Diario de contenido en redes (Siempre a las 9:00 AM hora local, o si fue encolado manualmente, reintentando cada 30 min hasta salir)
        let dailyStoriesSent = false;
        let dailyStoriesPending = false;
        try {
            const [settingRows] = await query("SELECT value FROM bot_settings WHERE key = 'daily_stories_reminder'");
            const st = (settingRows.length > 0 && settingRows[0].value) ? settingRows[0].value : {};
            const lastSentDate = st.last_sent_date || null;
            const hasPendingManualOrRetry = (st.pending_retry === true && st.pending_date === dateISO);

            if (lastSentDate !== dateISO && (hour >= 9 || hasPendingManualOrRetry)) {
                const storiesResult = await sendDailyStoriesNotification(true);
                if (storiesResult.sentCount > 0) {
                    dailyStoriesSent = true;
                } else {
                    dailyStoriesPending = true;
                }
            }
        } catch (storiesErr) {
            console.error('[Stories Daily Cron] Error verificando aviso diario de contenido:', storiesErr.message);
        }

        // 2. Avisos de Posts del Día (a partir de las 9:00 AM hora local) + Avisos manuales encolados (a cualquier hora)
        // Si WhatsApp no está conectado, NO se marca reminder_sent_date ni se apaga pending_manual_alert, quedando en espera para el siguiente intento cada 30 min o al reconectar.
        const sql = `
            SELECT *
            FROM parrilla_cards
            WHERE deleted_at IS NULL
            AND (
                pending_manual_alert = TRUE
                OR (
                    $2 >= 9
                    AND publish_date IS NOT NULL
                    AND TO_CHAR(publish_date, 'YYYY-MM-DD') = $1
                    AND (reminder_sent_date IS NULL OR TO_CHAR(reminder_sent_date, 'YYYY-MM-DD') != $1)
                )
            )
        `;
        const [reminders] = await query(sql, [dateISO, hour]);

        let count = 0;
        let pendingPostsCount = 0;

        if (reminders.length > 0 && !connectedAcc) {
            pendingPostsCount = reminders.length;
            console.log(`[Parrilla Cola] ⏳ WhatsApp desconectado. Hay ${pendingPostsCount} post(s) del día en espera de conexión. Se reintentará automáticamente cada 30 min o apenas conecte el QR.`);
        } else {
            for (const card of reminders) {
                const notifyRes = await sendCardNotificationToTeam(card);
                if (notifyRes.sentCount > 0) {
                    await query(
                        'UPDATE parrilla_cards SET reminder_sent_date = $1::date, pending_manual_alert = FALSE WHERE id = $2',
                        [dateISO, card.id]
                    );
                    count++;
                } else {
                    pendingPostsCount++;
                }
            }
        }

        if (res) {
            res.json({
                success: true,
                dailyStoriesSent,
                dailyStoriesPending,
                postsSent: count,
                postsPendingInQueue: pendingPostsCount,
                message: `Cola procesada. Enviados: ${count} post(s). En espera de conexión: ${pendingPostsCount} post(s).`
            });
        }
        return { count, pendingPostsCount, dailyStoriesSent, dailyStoriesPending };
    } catch (error) {
        console.error('Error in parrilla cron job:', error);
        if (res) res.status(500).json({ error: 'Failed to run parrilla job' });
    } finally {
        isProcessingParrillaQueue = false;
    }
};

let isRunningFollowUp = false;

const run24hFollowUp = async (req, res) => {
    if (isRunningFollowUp) {
        console.log('[24h FollowUp] ⚠️ Ejecución omitida: ya hay un proceso de seguimiento 24h activo.');
        if (res) return res.json({ success: true, count: 0, message: 'Proceso ya en ejecución' });
        return { count: 0, skipped: true };
    }
    isRunningFollowUp = true;

    try {
        const { now, hour: currentHour } = getLocalDateParts();

        const isForce = req && (req.query.force === 'true' || req.body?.force === true);
        if (!isForce && (currentHour < 9 || currentHour >= 19)) {
            const skipMsg = `[24h FollowUp] Fuera de horario comercial (${currentHour}:00 hrs). Se reanudará entre 9:00 y 19:00 hrs.`;
            console.log(skipMsg);
            if (res) return res.json({ success: true, count: 0, message: skipMsg });
            return { count: 0, skipped: true };
        }

        // 🔒 Filtro estricto multicapa:
        // 1. seguimiento_24h_enviado != true
        // 2. tags no contenga SEGUIMIENTO_24H_ENVIADO
        // 3. Verificación cruzada en tabla mensajes: que NO exista ningún mensaje previo de seguimiento para ese lead
        // 4. No enviar a leads con estado RESUELTO
        // 5. Solo clientes que NO respondieron (ultimo_emisor != 'CLIENTE')
        // 6. Inactividad de al menos 24 horas y máximo 7 días
        const sql = `
            SELECT id, telefono, nombre, cuenta, tags
            FROM leads
            WHERE estado_atencion != 'RESUELTO'
              AND (seguimiento_24h_enviado IS NOT TRUE)
              AND (tags IS NULL OR tags NOT LIKE '%SEGUIMIENTO_24H_ENVIADO%')
              AND ultimo_emisor IN ('BOT', 'HUMANO')
              AND fecha_actualizacion <= NOW() - INTERVAL '24 hours'
              AND fecha_actualizacion >= NOW() - INTERVAL '7 days'
              AND NOT EXISTS (
                  SELECT 1 FROM mensajes m
                  WHERE m.lead_id = leads.id
                    AND m.texto LIKE '%dar seguimiento a tu consulta%'
              )
            ORDER BY id ASC
            LIMIT 15
        `;

        const [leads] = await query(sql);
        let count = 0;

        for (const lead of leads) {
            const cleanPhone = lead.telefono.replace('@s.whatsapp.net', '');
            const leadName = lead.nombre && !['Cliente', 'Usuario', 'Lead'].includes(lead.nombre.trim()) ? lead.nombre.trim() : '';
            const greeting = leadName ? `¡Hola ${leadName}! 🙌` : `¡Hola! 🙌`;
            const message = `${greeting} Te escribimos de ${features.BRAND_NAME} para dar seguimiento a tu consulta. ¿Pudiste revisar la información o te gustaría que te ayudemos a agendar una cita con algún especialista? ¡Estamos a tus órdenes! 🏥`;
            const acc = lead.cuenta || 'principal';

            try {
                // 1. MARCAR PRIMERO EN BD: Evita cualquier envío duplicado ante lentitud o reintentos
                const updatedTags = lead.tags ? `${lead.tags}, SEGUIMIENTO_24H_ENVIADO` : 'SEGUIMIENTO_24H_ENVIADO';
                await query(
                    `UPDATE leads
                     SET seguimiento_24h_enviado = TRUE,
                         tags = $1,
                         ultimo_mensaje = $2,
                         ultimo_emisor = 'BOT',
                         fecha_actualizacion = NOW()
                     WHERE id = $3`,
                    [updatedTags, message, lead.id]
                );

                await query(
                    `INSERT INTO mensajes (lead_id, emisor, texto, tipo, cuenta) VALUES ($1, $2, $3, $4, $5)`,
                    [lead.id, 'BOT', message, 'text', acc]
                );

                // 2. ENVIAR MENSAJE POR WHATSAPP (Exactamente 1 vez)
                await whatsappService.sendMessage(acc, cleanPhone, message);

                count++;
                console.log(`[24h FollowUp] ✅ Mensaje único enviado con éxito a lead #${lead.id} (${cleanPhone})`);
            } catch (err) {
                console.error(`[24h FollowUp] ❌ Error procesando lead #${lead.id}:`, err.message);
                // Asegurar que quede marcado para no reintentar en bucle
                await query(
                    `UPDATE leads SET seguimiento_24h_enviado = TRUE WHERE id = $1`,
                    [lead.id]
                ).catch(() => {});
            }
        }

        if (res) res.json({ success: true, count, message: `Seguimiento automático 24h enviado a ${count} cliente(s).` });
        return { count };
    } catch (error) {
        console.error('[24h FollowUp] Error general:', error);
        if (res) res.status(500).json({ error: error.message });
    } finally {
        isRunningFollowUp = false;
    }
};

module.exports = {
    runFollowUp,
    run24hFollowUp,
    checkParrillaReminders,
    sendCardNotificationToTeam,
    formatParrillaNotification,
    formatDailyStoriesNotification,
    sendDailyStoriesNotification,
    getLocalDateParts,
    getNotificationRecipients
};
