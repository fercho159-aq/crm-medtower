const { query } = require('../config/db');
const { encrypt } = require('../config/encryption');
const whatsappService = require('../services/whatsappService');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const features = require('../config/features');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ═══════════════════════════════════════════════════════════════
//  MIT Medical Tower — Catálogo completo
// ═══════════════════════════════════════════════════════════════

const ESPECIALIDADES = [
    { id: 'medicina_general', nombre: 'Medicina General', emoji: '🏥', aliases: ['medico general', 'general', 'consulta general'], costo: 100, anticipo: 0, resto: 100, horario: 'Todos los días, 8:30 am a 8:30 pm', sinCita: true, sinAnticipo: true },
    { id: 'angiologia', nombre: 'Angiología', emoji: '🫀', aliases: ['angiologo', 'venas', 'varices', 'circulacion'], costo: 1000, anticipo: 200, resto: 800, horario: 'Horario abierto' },
    { id: 'cardiologia', nombre: 'Cardiología', emoji: '❤️', aliases: ['cardiologo', 'corazon', 'presion arterial'], costo: 1000, anticipo: 300, resto: 700, horario: 'A partir de las 4:00 pm, todos los días excepto sábado' },
    { id: 'cirugia_plastica', nombre: 'Cirugía Plástica (valoración)', emoji: '✨', aliases: ['cirujano plastico', 'plastica', 'estetica'], costo: 700, anticipo: 200, resto: 500, horario: 'Horario abierto', nota: 'Precio de la valoración, no del procedimiento' },
    { id: 'gastroenterologia', nombre: 'Gastroenterología', emoji: '🫁', aliases: ['gastroenterologo', 'estomago', 'intestino', 'digestion', 'gastritis', 'colitis', 'reflujo'], costo: 800, anticipo: 250, resto: 550, horario: 'Horario abierto', nota: 'También realizan endoscopias y colonoscopias' },
    { id: 'ginecologia', nombre: 'Ginecología', emoji: '🌸', aliases: ['ginecologo', 'embarazo', 'prenatal', 'mujer'], costo: 700, anticipo: null, resto: null, horario: null, asesorConfirma: 'anticipo y horario' },
    { id: 'infectologia', nombre: 'Infectología', emoji: '🦠', aliases: ['infectologo', 'infeccion', 'vih', 'hepatitis'], costo: 1500, anticipo: 200, resto: 1300, horario: 'Horario abierto' },
    { id: 'medicina_interna', nombre: 'Medicina Interna', emoji: '🩺', aliases: ['internista'], costo: 1000, anticipo: null, resto: null, horario: 'Horario abierto', asesorConfirma: 'anticipo ($200 a $300 según el especialista)' },
    { id: 'nefrologia', nombre: 'Nefrología', emoji: '🫘', aliases: ['nefrologo', 'rinones', 'riñones', 'riñon'], costo: 1100, anticipo: 300, resto: 800, horario: 'Horario abierto' },
    { id: 'neumologia', nombre: 'Neumología', emoji: '🫁', aliases: ['neumologo', 'pulmones', 'respiracion', 'asma', 'tos'], costo: 1000, anticipo: 300, resto: 700, horario: 'Horario abierto' },
    { id: 'neurologia', nombre: 'Neurología', emoji: '🧠', aliases: ['neurologo', 'cerebro', 'migraña', 'epilepsia', 'dolor de cabeza'], costo: 1500, anticipo: 500, resto: 1000, horario: 'Horario abierto' },
    { id: 'hematologia', nombre: 'Hematología', emoji: '🩸', aliases: ['hematologo', 'sangre', 'anemia', 'leucemia'], costo: 2000, anticipo: 500, resto: 1500, horario: 'Horario abierto' },
    { id: 'urologia', nombre: 'Urología', emoji: '🩺', aliases: ['urologo', 'prostata', 'vias urinarias', 'disfuncion erectil'], costo: 800, anticipo: 200, resto: 600, horario: 'Lunes, miércoles y sábado, de 10:00 am a 12:00 pm' },
    { id: 'otorrino', nombre: 'Otorrinolaringología', emoji: '👂', aliases: ['otorrino', 'oido', 'oído', 'nariz', 'garganta'], costo: 800, anticipo: 250, resto: 550, horario: 'Martes, jueves y sábado, de 10:00 am a 12:00 pm' },
    { id: 'pediatria', nombre: 'Pediatría', emoji: '👶', aliases: ['pediatra', 'niño', 'niña', 'bebe', 'hijo', 'hija'], costo: null, anticipo: null, resto: null, horario: null, asesorConfirma: 'costo, anticipo y horario', esMenor: true },
    { id: 'psicologia', nombre: 'Psicología', emoji: '🧘', aliases: ['psicologo', 'terapia', 'ansiedad', 'depresion'], costo: 500, anticipo: 200, resto: 300, horario: 'Horario abierto' },
    { id: 'psiquiatria', nombre: 'Psiquiatría', emoji: '🧠', aliases: ['psiquiatra', 'salud mental', 'bipolar'], costo: 700, anticipo: null, resto: null, horario: null, asesorConfirma: 'anticipo y horario' },
    { id: 'traumatologia', nombre: 'Traumatología y Ortopedia', emoji: '🦴', aliases: ['traumatologo', 'ortopedista', 'huesos', 'fractura', 'lesion', 'articulaciones', 'espalda', 'rodilla'], costo: 700, anticipo: 200, resto: 500, horario: 'Sábados y domingos, a partir de las 3:00 pm' },
    { id: 'celulas_madre', nombre: 'Células Madre', emoji: '🧬', aliases: ['celulas madre', 'stem cells'], costo: null, anticipo: null, resto: null, horario: null, asesorConfirma: 'costo e información tras valoración' },
];

const ESTUDIOS_CON_CITA = [
    { id: 'doppler', nombre: 'Ultrasonido Doppler', area: 'Angiología', costo: 3000, anticipo: 1000, resto: 2000 },
    { id: 'holter', nombre: 'Holter', area: 'Cardiología', costo: 1500, anticipo: 500, resto: 1000, desc: 'monitoreo del ritmo del corazón' },
    { id: 'mapa', nombre: 'MAPA', area: 'Cardiología', costo: 1500, anticipo: 500, resto: 1000, desc: 'monitoreo de presión arterial 24h' },
    { id: 'ecocardiograma', nombre: 'Ecocardiograma', area: 'Cardiología', costo: 1500, anticipo: 500, resto: 1000, desc: 'ultrasonido del corazón' },
    { id: 'endoscopia', nombre: 'Endoscopia y colonoscopia', area: 'Gastroenterología', costo: null, anticipo: null, resto: null, asesorConfirma: true },
];

const LABORATORIO = [
    { nombre: 'Química sanguínea de 6 elementos', precio: 150 },
    { nombre: 'Química sanguínea de 12 elementos', precio: 300 },
    { nombre: 'Química sanguínea de 27 elementos', precio: 400 },
    { nombre: 'Biometría hemática completa', precio: 80 },
    { nombre: 'Examen general de orina', precio: 60 },
    { nombre: 'Toma de glucosa', precio: 50 },
    { nombre: 'Toma de presión', precio: 20 },
    { nombre: 'Aplicación de medicamento', precio: 20, nota: 'Requiere receta médica' },
];

const PROCEDIMIENTOS = [
    { id: 'mommy_makeover', nombre: 'Mommy Makeover', desde: '$149,900', cat: 'estetica', aliases: ['mommy', 'mommy makeover'] },
    { id: 'abdominoplastia', nombre: 'Abdominoplastia', desde: '$109,900', cat: 'estetica', aliases: ['abdominoplastia', 'abdomen', 'panza'] },
    { id: 'implantes', nombre: 'Implantes mamarios', desde: '$60,000', cat: 'estetica', aliases: ['implantes', 'aumento de busto', 'senos', 'busto'] },
    { id: 'rinoplastia', nombre: 'Rinoplastia ultrasónica', desde: '$47,999', cat: 'estetica', aliases: ['rinoplastia', 'nariz'] },
    { id: 'circuncision', nombre: 'Circuncisión pediátrica', desde: '$22,999', cat: 'pediatrica', aliases: ['circuncision', 'circuncisión'], esMenor: true },
    { id: 'orquidopexia', nombre: 'Orquidopexia unilateral', desde: '$24,999', cat: 'pediatrica', aliases: ['orquidopexia', 'testiculo'], esMenor: true },
    { id: 'hernia', nombre: 'Hernia umbilical o inguinal por laparoscopía', desde: '$45,000', cat: 'hernia', aliases: ['hernia'] },
];

function getPromocion() {
    const hoy = new Date();
    if (hoy <= new Date('2026-11-30T23:59:59')) {
        return { activa: true, texto: '🎉 *Promoción:* Orquidopexia unilateral — paquete especial de *$24,999 con valoración gratis*. Válido hasta el 30 de noviembre.' };
    }
    return { activa: false };
}

const CLINICA = {
    direccion: 'Blvd. Prados de Aragón 8B, Col. Prados de Aragón, Cd. Nezahualcóyotl, Estado de México, C.P. 57179',
    whatsapp: '55 2838 0715',
    web: 'medtower.com.mx',
    horario: 'Lunes a domingo, de 9:00 a 21:00 horas',
    maps: 'https://maps.app.goo.gl/cPKQ7FqE3vj93rrw8',
};

const CIERRE_VENTA = '¡Perfecto! Un asesor de MIT confirmará la disponibilidad y te enviará los datos para pagar tu anticipo. Tu cita queda apartada al recibirlo.\n\n📍 Te esperamos en Blvd. Prados de Aragón 8B, Col. Prados de Aragón, Cd. Nezahualcóyotl.';

const CIERRE_SIN_VENTA = 'Entiendo perfectamente. En MIT Medical Tower nos preocupamos por la salud e integridad de todos nuestros pacientes. Por eso nuestros precios reflejan altos estándares de calidad, seguridad e higiene en cada consulta y procedimiento. Si más adelante decides atenderte con nosotros, aquí estaremos para ayudarte. ¡Cuídate mucho!';

const CIERRE_SIN_VENTA_DISTANCIA = 'Entiendo, sabemos que la distancia es importante. En MIT Medical Tower nos preocupamos por la salud e integridad de todos nuestros pacientes, y por eso cuidamos altos estándares de calidad, seguridad e higiene. Si en algún momento decides atenderte con nosotros, con gusto te recibimos en Blvd. Prados de Aragón 8B, Cd. Nezahualcóyotl.';

// ═══════════════════════════════════════════════════════════════
//  Helpers de formato
// ═══════════════════════════════════════════════════════════════

function fmtEspecialidad(esp) {
    let msg = `${esp.emoji} *${esp.nombre}*\n\n`;
    if (esp.sinCita) {
        msg += `💰 Costo: *$${esp.costo} MXN* — se paga directamente en la clínica.\n🕐 Horario: ${esp.horario}.\n\n_No necesitas cita ni anticipo._`;
        return msg;
    }
    if (esp.costo) msg += `💰 Costo total: *$${esp.costo.toLocaleString()} MXN*\n`;
    else msg += `💰 Costo: un asesor te lo confirma.\n`;
    if (esp.anticipo) {
        msg += `• Anticipo para apartar: *$${esp.anticipo}*\n`;
        msg += `• Resto el día de tu cita: *$${esp.resto}*\n`;
    } else if (esp.asesorConfirma) {
        msg += `• ${esp.asesorConfirma.charAt(0).toUpperCase() + esp.asesorConfirma.slice(1)}: un asesor te lo confirma.\n`;
    }
    if (esp.horario) msg += `🕐 Horario: ${esp.horario}.\n`;
    if (esp.nota) msg += `📌 ${esp.nota}\n`;
    msg += `\n¿Te gustaría agendar tu cita?`;
    return msg;
}

function fmtProcedimiento(proc) {
    let msg = `✨ *${proc.nombre}*\n\nPrecio desde *${proc.desde} MXN*.\n`;
    msg += `_El costo final se confirma en una valoración con el cirujano, que cuesta $700 con $200 de anticipo._\n`;
    const promo = getPromocion();
    if (promo.activa && proc.id === 'orquidopexia') {
        msg += `\n${promo.texto}\n`;
    }
    msg += `\n¿Te gustaría agendar la valoración?`;
    return msg;
}

function fmtEstudio(est) {
    let msg = `🔬 *${est.nombre}* (${est.area})\n\n`;
    if (est.desc) msg += `${est.desc}\n`;
    if (est.costo) {
        msg += `💰 Costo total: *$${est.costo.toLocaleString()} MXN*\n`;
        msg += `• Anticipo: *$${est.anticipo}*\n• Resto: *$${est.resto}*\n`;
    } else {
        msg += `💰 El costo y las indicaciones los confirma un asesor.\n`;
    }
    msg += `\n¿Te gustaría agendar este estudio?`;
    return msg;
}

// ═══════════════════════════════════════════════════════════════
//  Matching helpers
// ═══════════════════════════════════════════════════════════════

function matchSpecialtyByText(msg) {
    const lower = msg.toLowerCase();
    return ESPECIALIDADES.findIndex(e => {
        if (lower.includes(e.id.replace(/_/g, ' '))) return true;
        const nombre = e.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const lowerNorm = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (lowerNorm.includes(nombre)) return true;
        return e.aliases.some(a => {
            const aNorm = a.normalize('NFD').replace(/[̀-ͯ]/g, '');
            return lowerNorm.includes(aNorm);
        });
    });
}

function matchSpecialtyChoice(msg) {
    const num = parseInt(msg, 10);
    if (!isNaN(num) && num >= 1 && num <= ESPECIALIDADES.length) return num - 1;
    const idx = matchSpecialtyByText(msg);
    return idx >= 0 ? idx : null;
}

function matchProcedureByText(msg) {
    const lower = msg.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return PROCEDIMIENTOS.findIndex(p =>
        p.aliases.some(a => lower.includes(a.normalize('NFD').replace(/[̀-ͯ]/g, '')))
    );
}

function matchEstudioByText(msg) {
    const lower = msg.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return ESTUDIOS_CON_CITA.findIndex(e => lower.includes(e.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')) || lower.includes(e.id));
}

function isGreetingMsg(msg) {
    const greetings = ['hola', 'holaa', 'holaaa', 'ola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes', 'buenas noches', 'hello', 'hi', 'hey', 'inicio', 'comenzar', 'start', 'que tal', 'qué tal', 'buenass', 'saludos', 'disculpa', 'disculpe', 'hla'];
    if (greetings.includes(msg)) return true;
    // Saludos cortos que inician mensajes
    if (/^(hola|buen[oa]s|hi|hey|ola)\b/.test(msg)) return true;
    return false;
}

function isAccept(msg) {
    const t = msg.trim();
    const yesWords = ['si', 'sí', 'sii', 'siii', 'siiii', 'sip', 'simon', 'simón', 'yes', 'yess', 'yeah', 'ya', 'claro', 'claro que si', 'claro que sí', 'por supuesto', 'porsupuesto', 'dale', 'va', 'vale', 'ok', 'okay', 'okey', 'okas', 'listo', 'perfecto', 'adelante', 'quiero', 'quiero agendar', 'me interesa', 'si porfa', 'sí porfa', 'si por favor', 'sí por favor', 'si quiero', 'sí quiero', 'si me interesa', 'sí me interesa', 'agendar', 'agenda', 'agendame', 'agéndame', 'apartar', 'aparta', 'si me gustaria', 'sí me gustaría', 'me gustaria', 'me gustaría', 'confirmo', 'esta bien', 'está bien', 'ta bien', 'sale', 'por favor', 'porfavor', 'porfa', '1', 'si agendar', 'claro agendar'];
    if (yesWords.includes(t)) return true;
    // Patrones comunes
    if (/^(si|sí|sip|claro|va|dale|ok|okay|perfecto|me interesa|quiero|agendar|agenda|me gustari?a|si me|sí me|si porfa|sí porfa)\b/.test(t)) return true;
    return false;
}

function isDecline(msg) {
    const t = msg.trim();
    const noWords = ['no', 'nop', 'nope', 'nel', 'nah', 'noup', 'no gracias', 'gracias no', 'paso', 'por ahora no', 'ahorita no', 'ahora no', 'ya no', 'otro dia', 'otro día', 'despues', 'después', 'luego', 'mas tarde', 'más tarde', 'no quiero', 'no me interesa', 'no me late', 'no por ahora', 'cuando pueda', 'lo pensare', 'lo pensaré', 'lo voy a pensar', 'lo pienso', 'déjame pensarlo', 'dejame pensarlo', 'lo checo', 'lo veo', 'esta caro', 'está caro', 'muy caro', 'muy cara', 'carisimo', 'carísimo', 'no me alcanza', 'no tengo dinero', 'no tengo lana', 'no puedo pagar', 'queda lejos', 'esta lejos', 'está lejos', 'muy lejos', 'me queda lejos'];
    if (noWords.includes(t)) return true;
    if (/^(no|nop|nel|paso|despues|después|luego|otro dia|otro día|lo pens|lo voy|me queda lejos|esta lejos|está lejos|muy lejos|muy caro|esta caro|está caro|no me alcan|no tengo)\b/.test(t)) return true;
    return false;
}

// Detección de síntomas → sugerir una especialidad (NO diagnostica, solo orienta)
function matchSymptomToSpecialty(msg) {
    const m = msg.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // Primero: menores de edad (prioridad alta — si menciona hijo/a, siempre es pediatría)
    if (/(mi hijo|mi hija|mi bebe|mi nino|mi nina|mi chamaco|mi chamaca|mi peque|vacuna para|nino de \d|nina de \d)/i.test(m)) return 'pediatria';
    // Síntomas por especialidad
    if (/(dolor de cabeza|migrana|mareo|convulsion|epilepsia|desmayo|temblor|parkinson|alzheimer|hormigue|me da vuelta)/i.test(m)) return 'neurologia';
    if (/(dolor de pecho|pecho me duele|presion alta|hipertension|palpitacion|taquicardia|arritmia|corazon)/i.test(m)) return 'cardiologia';
    if (/(dolor de pansa|dolor de panza|dolor abdominal|me duele el estomago|me duele la pansa|me duele la panza|reflujo|gastritis|acidez|diarrea|estrenimiento|colitis|vomito|hinchazon|endoscopia|colonoscopia|intestino)/i.test(m)) return 'gastroenterologia';
    if (/(ansiedad|depresion|estres|insomnio|panico|triste|problemas emocionales|salud mental|terapia|psicolog)/i.test(m)) return 'psicologia';
    if (/(fractura|me cai|caida|torcedura|esguince|dolor de rodilla|dolor de espalda|dolor de cuello|hombro|lesion|tendinitis|artritis|artrosis)/i.test(m)) return 'traumatologia';
    if (/(embaraz|menstruacion|regla|anticonceptivo|papanicolau|papanicolaou|menopausia|utero|ovario|prenatal|parto|planificacion familiar|revision ginecolog)/i.test(m)) return 'ginecologia';
    if (/(prostata|erectil|impotencia|varicocele|incontinencia|calculo renal|piedra en el rinon|vias urinarias|miccion|orino mucho)/i.test(m)) return 'urologia';
    if (/(oido|otitis|sordera|tinnitus|zumbido|sinusitis|amigdalitis|ronquera|voz|me duele la garganta|me duele el oido|me duele la nariz)/i.test(m)) return 'otorrino';
    if (/(varices|arana|circulacion|venas|piernas hinchadas|pie frio|pies frios)/i.test(m)) return 'angiologia';
    if (/(tos cronica|falta de aire|no puedo respirar|asma|neumonia|bronquitis|pulmon|covid|me ahogo)/i.test(m)) return 'neumologia';
    if (/(rinon|dialisis|creatinina|insuficiencia renal)/i.test(m)) return 'nefrologia';
    if (/(anemia|leucemia|plaquetas|hemoglobina|coagulacion)/i.test(m)) return 'hematologia';
    if (/(vih|sida|hepatitis|ets|its|infeccion por|infectado|sifilis|gonorrea|clamidia)/i.test(m)) return 'infectologia';
    if (/(diabetes|tiroides|colesterol|internista|chequeo general|checkup|examen general)/i.test(m)) return 'medicina_interna';
    if (/(aumento de busto|operarme la nariz|liposuccion|abdominoplastia|rinoplastia|mommy|implantes)/i.test(m)) return 'cirugia_plastica';
    // Último: síntomas leves → medicina general
    if (/(fiebre|gripa|gripe|tos leve|resfriado|dolor de garganta|me siento mal|cansancio|malestar general|dolor de cuerpo|me duele el cuerpo)/i.test(m)) return 'medicina_general';
    return null;
}

// Detecta si pide ayuda / no sabe qué necesita
function needsGuidance(msg) {
    return /(no se que|no sé qué|no se cual|no sé cuál|no estoy segur|ayuda|orienta|que me recomien|qué me recomien|no entiendo|informacion|información)/i.test(msg);
}

// Detecta pregunta de "¿cuánto cuesta X?"
function isPriceQuery(msg) {
    return /(cuanto cuesta|cuánto cuesta|cuanto vale|cuánto vale|que precio|qué precio|cual es el precio|cuál es el precio|cuanto me sale|precio de|costo de|cuanto es|cuánto es)/i.test(msg);
}

// Detecta deseo de agendar sin especificar
function wantsToSchedule(msg) {
    return /(quiero una cita|quiero agendar|me gustaria agendar|me gustaría agendar|necesito cita|necesito consulta|agendar cita|apartar cita|hacer una cita|sacar cita)/i.test(msg);
}

function isEmergency(msg) {
    return msg.includes('emergencia') || (msg.includes('dolor fuerte') && msg.includes('pecho')) || msg.includes('no puedo respirar') || msg.includes('sangrado abundante') || msg.includes('me desmay') || msg.includes('accidente grave');
}

function isCrisis(msg) {
    return msg.includes('suicid') || msg.includes('quitarme la vida') || msg.includes('hacerme daño') || msg.includes('no quiero vivir') || msg.includes('matarme');
}

function matchMainMenu(msg) {
    if (msg === '1' || msg.includes('cita') || msg.includes('agendar') || msg.includes('consulta') || msg.includes('especialista')) return 1;
    if (msg === '2' || msg.includes('cirugia') || msg.includes('cirugía') || msg.includes('procedimiento') || msg.includes('operacion') || msg.includes('operación')) return 2;
    if (msg === '3' || msg.includes('laboratorio') || msg.includes('lab') || msg.includes('estudio') || msg.includes('analisis') || msg.includes('análisis') || msg.includes('sangre') || msg.includes('orina') || msg.includes('quimica') || msg.includes('química')) return 3;
    if (msg === '4' || msg.includes('ubicacion') || msg.includes('ubicación') || msg.includes('horario') || msg.includes('direccion') || msg.includes('dirección') || msg.includes('donde') || msg.includes('dónde') || msg.includes('mapa')) return 4;
    if (msg === '5' || msg.includes('asesor') || msg.includes('hablar') || msg.includes('persona') || msg.includes('humano')) return 5;
    return null;
}

function matchFAQ(msg) {
    if (msg.includes('como pago') || msg.includes('cómo pago') || msg.includes('forma de pago') || msg.includes('aceptan tarjeta')) {
        return 'Un asesor de MIT te envía los datos y las formas de pago para tu anticipo al confirmar tu cita.';
    }
    if (msg.includes('quien me atiende') || msg.includes('quién me atiende') || msg.includes('nombre del doctor') || msg.includes('como se llama') || msg.includes('cómo se llama')) {
        return 'Un asesor te comparte la información del especialista al confirmar tu cita.';
    }
    if (msg.includes('promocion') || msg.includes('promoción') || msg.includes('descuento') || msg.includes('oferta')) {
        const promo = getPromocion();
        return promo.activa ? promo.texto : 'Por el momento no tenemos promociones vigentes. Los precios de nuestros servicios son los indicados. ¿Puedo ayudarte con algo más?';
    }
    if (msg.includes('necesito cita') || msg.includes('sin cita') || msg.includes('requiero cita')) {
        return 'Las consultas con especialista, estudios y procedimientos son con cita previa. *Medicina general* y *laboratorio* no requieren cita, se pagan directamente en la clínica.';
    }
    if (msg.includes('que incluye el precio') || msg.includes('qué incluye')) {
        return 'El especialista te explica en la valoración todo lo que incluye tu procedimiento y el costo final según tu caso.';
    }
    return null;
}

function getSelection(tags) {
    const m = (tags || '').match(/SEL:(\w+):(\w+)/);
    return m ? { type: m[1], id: m[2] } : null;
}

// ═══════════════════════════════════════════════════════════════
//  Meta / Webhook (infraestructura)
// ═══════════════════════════════════════════════════════════════

const handleWebhookVerification = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            res.status(200).send(challenge);
        } else { res.sendStatus(403); }
    } else { res.sendStatus(400); }
};

const sendMetaMessage = async (accountId, to, body, buttons = null) => {
    const token = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_ID;
    if (!phoneId || !token) return;
    let messageData = { messaging_product: "whatsapp", recipient_type: "individual", to };
    if (buttons) {
        messageData.type = "interactive";
        messageData.interactive = { type: "button", body: { text: body }, action: { buttons } };
    } else {
        messageData.type = "text";
        messageData.text = { body };
    }
    try {
        const response = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(messageData)
        });
        if (!response.ok) console.error(`[Meta:${accountId}] Error: ${response.status}`);
    } catch (error) { console.error(`[Meta:${accountId}] Error:`, error); }
};

const handleIncomingMessage = async (req, res) => {
    const body = req.body;
    if (body.object) {
        if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const value = body.entry[0].changes[0].value;
            const msgObj = value.messages[0];
            const from = msgObj.from;
            const contactName = value.contacts?.[0]?.profile?.name || 'Cliente';
            let accountId = 'principal';
            const msgText = msgObj.type === 'text' ? msgObj.text.body :
                (msgObj.type === 'interactive' && msgObj.interactive?.type === 'button_reply') ? msgObj.interactive.button_reply.id : '';
            if (msgText) {
                handleUnifiedMessage(accountId, from, contactName, msgText, 'meta').catch(err => console.error('[MetaWebhook] Error:', err));
            }
        }
        res.sendStatus(200);
    } else { res.sendStatus(404); }
};

const saveMessage = async (leadId, emisor, texto, cuenta, tipo = 'text') => {
    try {
        await query('INSERT INTO mensajes (lead_id, emisor, texto, cuenta, tipo) VALUES ($1, $2, $3, $4, $5)', [leadId, emisor, texto, cuenta, tipo]);
        const socketService = require('../services/socketService');
        socketService.emitToRoom(`lead_${leadId}`, 'new_message', { lead_id: leadId, emisor, texto, cuenta, tipo, fecha: new Date().toISOString() });
        socketService.emitToAll('lead_updated', { lead_id: leadId });
    } catch (err) { console.error(`[saveMessage] Error: ${err.message}`); }
};

// ═══════════════════════════════════════════════════════════════
//  Bot Flow Principal
// ═══════════════════════════════════════════════════════════════

const handleUnifiedMessage = async (accountId, jid, contactName, msgText, deliveryMethod, msgType = 'text', isFromMe = false) => {
    global.botLogs = global.botLogs || [];
    const log = (text) => {
        const entry = `[${new Date().toISOString()}] [${accountId}:${deliveryMethod}] ${text}`;
        console.log(entry);
        global.botLogs.push(entry);
        if (global.botLogs.length > 500) global.botLogs.shift();
    };

    const from = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
    log(`Mensaje de ${from} (${contactName}): "${msgText}"`);
    if (!msgText) return;

    try {
        // --- Mensajes salientes (isFromMe) ---
        if (isFromMe) {
            if (msgText.includes('Un asesor de MIT') || msgText.includes('MIT Medical Tower')) return;
            let [rows] = await query('SELECT * FROM leads WHERE telefono = $1 OR telefono = $2', [jid, from]);
            if (rows.length === 0) return;
            const lead = rows[0];
            await query("UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'HUMANO', step_estado = 99, estado_atencion = 'EN_CURSO', fecha_actualizacion = NOW() WHERE id = $2", [msgText, lead.id]);
            await saveMessage(lead.id, 'HUMANO', msgText, accountId, msgType);
            return;
        }

        // --- Buscar o crear lead ---
        let [rows] = await query('SELECT * FROM leads WHERE telefono = $1 OR telefono = $2', [jid, from]);
        let lead;
        let isNewInteraction = false;

        if (rows.length === 0) {
            const [result] = await query("INSERT INTO leads (nombre, telefono, ultimo_mensaje, ultimo_emisor, cuenta, step_estado, estado_atencion) VALUES ($1, $2, $3, 'CLIENTE', $4, 0, 'PENDIENTE') RETURNING *", [contactName, jid, msgText, accountId]);
            lead = result[0];
            isNewInteraction = true;
        } else {
            lead = rows[0];
            if (!lead.telefono.includes('@')) {
                await query('UPDATE leads SET telefono = $1 WHERE id = $2', [jid, lead.id]);
                lead.telefono = jid;
            }
        }

        // --- Protección: si un humano ya intervino, bot se silencia ---
        const [humanMessages] = await query("SELECT 1 FROM mensajes WHERE lead_id = $1 AND emisor = 'HUMANO' LIMIT 1", [lead.id]);
        const isHumanIntervened = humanMessages.length > 0 || lead.step_estado === 99 || lead.estado_atencion === 'EN_CURSO' || !!lead.vendedor_id;

        if (isHumanIntervened) {
            log(`Lead ID=${lead.id} intervenido por humano. Bot silenciado.`);
            await query("UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', step_estado = 99, fecha_actualizacion = NOW() WHERE id = $2", [msgText, lead.id]);
            await saveMessage(lead.id, 'CLIENTE', msgText, accountId, msgType);
            return;
        }

        // --- Guardar mensaje del cliente ---
        await query("UPDATE leads SET ultimo_mensaje = $1, ultimo_emisor = 'CLIENTE', cuenta = $2, fecha_actualizacion = NOW() WHERE id = $3", [msgText, accountId, lead.id]);
        await saveMessage(lead.id, 'CLIENTE', msgText, accountId, msgType);

        // --- Bot activo? ---
        let flowConfig = null;
        try {
            const [settings] = await query("SELECT value FROM bot_settings WHERE key = 'flow_config'");
            if (settings.length > 0) {
                flowConfig = settings[0].value;
                if (typeof flowConfig === 'string') try { flowConfig = JSON.parse(flowConfig); } catch(e) {}
            }
        } catch (dbErr) { log(`Error config: ${dbErr.message}`); }
        if (!flowConfig || !flowConfig.enabled) return;
        const accountKey = `enabled_${accountId}`;
        if (flowConfig[accountKey] === false) return;

        // --- Detectar si es primera interacción ---
        const [outgoing] = await query("SELECT id FROM mensajes WHERE lead_id = $1 AND emisor IN ('BOT', 'HUMANO') LIMIT 1", [lead.id]);
        const isFirstInteraction = isNewInteraction || outgoing.length === 0;

        let step = lead.step_estado || 0;
        let tags = lead.tags || '';
        const cleanMsg = msgText.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const cleanMsgOrig = msgText.trim().toLowerCase();

        // --- Helpers ---
        const send = async (text) => {
            if (deliveryMethod === 'meta') await sendMetaMessage(accountId, from, text);
            else await whatsappService.sendMessage(accountId, jid, text);
            await saveMessage(lead.id, 'BOT', text, accountId, 'text');
        };

        const updateStep = async (newStep, newTag = null) => {
            let finalTags = tags;
            if (newTag) finalTags = tags ? `${tags}, ${newTag}` : newTag;
            await query("UPDATE leads SET step_estado = $1, tags = $2, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $3", [newStep, finalTags, lead.id]);
            tags = finalTags;
        };

        const setSelection = async (newStep, type, id, tag) => {
            let cleanTags = (tags || '').split(',').map(t => t.trim()).filter(t => !t.startsWith('SEL:')).join(', ');
            const sel = `SEL:${type}:${id}`;
            const finalTags = cleanTags ? `${cleanTags}, ${tag}, ${sel}` : `${tag}, ${sel}`;
            await query("UPDATE leads SET step_estado = $1, tags = $2, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $3", [newStep, finalTags, lead.id]);
            tags = finalTags;
        };

        const escalate = async (tag) => {
            const finalTags = tag ? (tags ? `${tags}, ${tag}` : tag) : tags;
            await query("UPDATE leads SET step_estado = 99, estado_atencion = 'PENDIENTE', tags = $1, cuenta = $2, ultimo_emisor = 'BOT', fecha_actualizacion = NOW() WHERE id = $3", [finalTags, accountId, lead.id]);
        };

        // --- Menú principal ---
        const sendMainMenu = async () => {
            await send(`¡Hola! 👋 Gracias por escribir a *MIT Medical Tower*.\n¿En qué te puedo ayudar hoy?\n\n1️⃣ Agendar cita con especialista\n2️⃣ Cirugía y procedimientos\n3️⃣ Laboratorio y estudios\n4️⃣ Ubicación y horarios\n5️⃣ Hablar con un asesor\n\nO escríbeme directamente qué necesitas 😊`);
            await updateStep(1);
        };

        // --- Lista de especialidades ---
        const sendEspecialidadPicker = async () => {
            let text = `📋 *Nuestras especialidades*\n\nEscribe el *número*:\n\n`;
            ESPECIALIDADES.forEach((e, i) => { text += `${i + 1}. ${e.emoji} ${e.nombre}\n`; });
            text += `\n0️⃣ Volver al menú`;
            await send(text);
            await updateStep(10);
        };

        // --- DETECCIÓN GLOBAL ---

        // Emergencias
        if (isEmergency(cleanMsg)) {
            await send('⚠️ Si tienes una emergencia médica, acude de inmediato al servicio de urgencias más cercano o llama al *911*. Tu salud es lo primero.');
            return;
        }
        if (isCrisis(cleanMsg)) {
            await send('Te escucho y me preocupo por ti. Por favor llama a la *Línea de la Vida: 800 911 2000*, es gratuita y está disponible las 24 horas. No estás solo/a. 💙');
            return;
        }

        // Volver al menú
        const wantsMenu = ['menu', 'menu', 'volver', 'inicio', '0'].includes(cleanMsgOrig);
        if (wantsMenu && step > 0) { await sendMainMenu(); return; }

        // Decline en pasos de "¿Te gustaría agendar?"
        if (isDecline(cleanMsgOrig) && [11, 21, 32].includes(step)) {
            const msg = cleanMsgOrig.includes('lejos') || cleanMsgOrig.includes('distancia') ? CIERRE_SIN_VENTA_DISTANCIA : CIERRE_SIN_VENTA;
            await send(msg);
            await escalate('CIERRE_SIN_VENTA');
            return;
        }

        // FAQ en pasos de navegación
        if (step <= 1) {
            const faq = matchFAQ(cleanMsgOrig);
            if (faq && !isGreetingMsg(cleanMsgOrig)) { await send(faq); return; }
        }

        // --- Primera interacción o saludo ---
        if (isFirstInteraction || isGreetingMsg(cleanMsgOrig) || step === 0) {
            if (!isGreetingMsg(cleanMsgOrig)) {
                // Match directo de especialidad
                const espIdx = matchSpecialtyByText(cleanMsg);
                if (espIdx >= 0) {
                    const esp = ESPECIALIDADES[espIdx];
                    await send(fmtEspecialidad(esp));
                    await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                    return;
                }
                // Match directo de procedimiento
                const procIdx = matchProcedureByText(cleanMsg);
                if (procIdx >= 0) {
                    await send(fmtProcedimiento(PROCEDIMIENTOS[procIdx]));
                    await setSelection(21, 'PROC', PROCEDIMIENTOS[procIdx].id, `INFO_${PROCEDIMIENTOS[procIdx].id.toUpperCase()}`);
                    return;
                }
                // Match de síntoma → sugerir especialidad
                const symptomSpec = matchSymptomToSpecialty(cleanMsgOrig);
                if (symptomSpec) {
                    const esp = ESPECIALIDADES.find(e => e.id === symptomSpec);
                    if (esp) {
                        await send(`Entiendo. Para eso te recomiendo *${esp.nombre}* ${esp.emoji}. Déjame darte los detalles:`);
                        await send(fmtEspecialidad(esp));
                        await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                        return;
                    }
                }
                // Quiere agendar pero no especifica
                if (wantsToSchedule(cleanMsgOrig)) {
                    await sendMainMenu();
                    return;
                }
                // Pide precio sin especificar
                if (isPriceQuery(cleanMsgOrig)) {
                    await send('¿De qué servicio te gustaría saber el precio? Dime la especialidad, cirugía o estudio que te interesa. 😊');
                    await updateStep(1);
                    return;
                }
                // Pide ayuda / no sabe qué necesita
                if (needsGuidance(cleanMsgOrig)) {
                    await send('Con gusto te oriento 🙂\nSi no estás seguro de qué especialista necesitas, nuestro *médico general* ($100, sin cita, de 8:30 am a 8:30 pm) puede valorarte y canalizarte al especialista adecuado.\n\n¿Quieres venir con medicina general o prefieres que un asesor te ayude a decidir?');
                    await updateStep(1);
                    return;
                }
                // FAQ (promociones, pago, etc.)
                const faq = matchFAQ(cleanMsgOrig);
                if (faq) { await send(faq); await updateStep(1); return; }
            }
            await sendMainMenu();
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 1 — Menú principal
        // ═══════════════════════════════════════
        if (step === 1) {
            // 1. Match directo de especialidad
            const espIdx = matchSpecialtyByText(cleanMsg);
            if (espIdx >= 0) {
                const esp = ESPECIALIDADES[espIdx];
                await send(fmtEspecialidad(esp));
                await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                return;
            }
            // 2. Match directo de procedimiento
            const procIdx = matchProcedureByText(cleanMsg);
            if (procIdx >= 0) {
                await send(fmtProcedimiento(PROCEDIMIENTOS[procIdx]));
                await setSelection(21, 'PROC', PROCEDIMIENTOS[procIdx].id, `INFO_${PROCEDIMIENTOS[procIdx].id.toUpperCase()}`);
                return;
            }
            // 3. Match directo de estudio
            const estIdx = matchEstudioByText(cleanMsg);
            if (estIdx >= 0) {
                await send(fmtEstudio(ESTUDIOS_CON_CITA[estIdx]));
                await setSelection(32, 'EST', ESTUDIOS_CON_CITA[estIdx].id, `INFO_${ESTUDIOS_CON_CITA[estIdx].id.toUpperCase()}`);
                return;
            }
            // 4. Match por síntoma
            const symptomSpec = matchSymptomToSpecialty(cleanMsgOrig);
            if (symptomSpec) {
                const esp = ESPECIALIDADES.find(e => e.id === symptomSpec);
                if (esp) {
                    await send(`Entiendo. Para eso te recomiendo *${esp.nombre}* ${esp.emoji}. Déjame darte los detalles:`);
                    await send(fmtEspecialidad(esp));
                    await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                    return;
                }
            }
            // 5. Preguntas de precio sin especificar
            if (isPriceQuery(cleanMsgOrig)) {
                await send('Claro, dime de qué servicio te gustaría saber el precio (ej. urología, rinoplastia, holter, química sanguínea). 😊');
                return;
            }
            // 6. Quiere agendar pero no especifica
            if (wantsToSchedule(cleanMsgOrig) && !matchMainMenu(cleanMsgOrig)) {
                await sendEspecialidadPicker();
                return;
            }
            // 7. Pide orientación
            if (needsGuidance(cleanMsgOrig)) {
                await send('Con gusto 🙂\nSi no estás seguro de qué especialista necesitas, nuestro *médico general* ($100, sin cita, 8:30 am a 8:30 pm) puede valorarte y canalizarte.\n\nO si prefieres, escribe *5* para hablar con un asesor.');
                return;
            }
            // 8. Lab general
            if (/^(lab|labo|laboratorio|quimica|química|biometria|biometría|examen de orina|glucosa|presion|presión)\b/i.test(cleanMsgOrig)) {
                let text = '🔬 *Laboratorio clínico (sin cita)*\n\n';
                LABORATORIO.forEach(l => { text += `• ${l.nombre}: *$${l.precio} MXN*${l.nota ? ` (${l.nota})` : ''}\n`; });
                text += '\n_Se pagan directamente en la clínica. Las indicaciones de preparación las confirma un asesor._\n\n¿Necesitas algo más? Escribe *"menú"* para ver opciones.';
                await send(text);
                return;
            }
            // 9. FAQ
            const faq = matchFAQ(cleanMsgOrig);
            if (faq) { await send(faq); return; }

            const choice = matchMainMenu(cleanMsgOrig);
            switch (choice) {
                case 1: await sendEspecialidadPicker(); return;
                case 2: {
                    let text = '✨ *Cirugía y procedimientos*\n\n*Cirugía plástica y estética:*\n';
                    PROCEDIMIENTOS.filter(p => p.cat === 'estetica').forEach((p, i) => { text += `${i + 1}. ${p.nombre} — desde ${p.desde}\n`; });
                    text += '\n*Cirugía pediátrica y hernias:*\n';
                    PROCEDIMIENTOS.filter(p => p.cat !== 'estetica').forEach((p, i) => { text += `${i + 5}. ${p.nombre} — desde ${p.desde}\n`; });
                    const promo = getPromocion();
                    if (promo.activa) text += `\n${promo.texto}\n`;
                    text += '\n_Todos requieren valoración previa ($700, anticipo $200). El costo final puede aumentar según la complejidad._\n\nEscribe el *número* del procedimiento o *0* para volver.';
                    await send(text);
                    await updateStep(20, 'INFO_PROCEDIMIENTOS');
                    return;
                }
                case 3: {
                    let text = '🔬 *Laboratorio y estudios*\n\n*Laboratorio clínico (sin cita):*\n';
                    LABORATORIO.forEach(l => { text += `• ${l.nombre}: *$${l.precio} MXN*${l.nota ? ` (${l.nota})` : ''}\n`; });
                    text += '\n_Se pagan directamente en la clínica. Las indicaciones de preparación las confirma un asesor._\n';
                    text += '\n*Estudios con cita:*\n';
                    ESTUDIOS_CON_CITA.forEach((e, i) => {
                        text += `${i + 1}. ${e.nombre}${e.costo ? ` — $${e.costo.toLocaleString()}` : ' — precio con asesor'}\n`;
                    });
                    text += '\nEscribe el *número* del estudio para más detalle, o *0* para volver.';
                    await send(text);
                    await updateStep(30, 'INFO_LAB_ESTUDIOS');
                    return;
                }
                case 4: {
                    await send(`📍 *MIT Medical Tower*\n\n🏢 ${CLINICA.direccion}\n🕐 Horario: ${CLINICA.horario}\n📞 WhatsApp: ${CLINICA.whatsapp}\n📧 mitmedicalt@yahoo.com\n🌐 ${CLINICA.web}\n\n📌 Google Maps:\n${CLINICA.maps}`);
                    await send('¿Te gustaría agendar una cita? Escribe *1* para ver especialidades o *"menú"* para volver.');
                    await updateStep(40, 'UBICACION');
                    return;
                }
                case 5: {
                    await send('👤 ¡Entendido! Te comunicaremos con un asesor de MIT Medical Tower. Un momento por favor...');
                    await escalate('HABLAR_ASESOR');
                    return;
                }
                default:
                    await send('No entendí tu respuesta. Escribe el *número* de la opción (1-5) o dime directamente qué necesitas.');
                    return;
            }
        }

        // ═══════════════════════════════════════
        //  STEP 10 — Elegir especialidad
        // ═══════════════════════════════════════
        if (step === 10) {
            const idx = matchSpecialtyChoice(cleanMsgOrig);
            if (idx !== null && idx >= 0 && idx < ESPECIALIDADES.length) {
                const esp = ESPECIALIDADES[idx];
                await send(fmtEspecialidad(esp));
                await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                return;
            }
            await send(`Escribe el *número* de la especialidad (1-${ESPECIALIDADES.length}) o *0* para volver.`);
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 11 — Info de especialidad, ¿agendar?
        // ═══════════════════════════════════════
        if (step === 11) {
            if (isAccept(cleanMsgOrig)) {
                const sel = getSelection(tags);
                const esp = sel ? ESPECIALIDADES.find(e => e.id === sel.id) : null;
                if (esp?.asesorConfirma && !esp.anticipo && !esp.costo) {
                    await send(`¡Perfecto! Un asesor de MIT te contactará para confirmar ${esp.asesorConfirma} y agendar tu cita.\n\n📍 ${CLINICA.direccion}`);
                    await escalate(`CITA_${esp.id.toUpperCase()}`);
                    return;
                }
                await send('¡Perfecto! Para agendar tu cita necesito tu *nombre completo*, por favor. ✏️');
                await updateStep(70);
                return;
            }
            if (isDecline(cleanMsgOrig)) {
                const msg = /lejos|distancia/i.test(cleanMsgOrig) ? CIERRE_SIN_VENTA_DISTANCIA : CIERRE_SIN_VENTA;
                await send(msg);
                await escalate('CIERRE_SIN_VENTA');
                return;
            }
            // Cambio de tema: otra especialidad / procedimiento
            const otherEsp = matchSpecialtyByText(cleanMsg);
            if (otherEsp >= 0) {
                const esp = ESPECIALIDADES[otherEsp];
                await send(fmtEspecialidad(esp));
                await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                return;
            }
            const otherProc = matchProcedureByText(cleanMsg);
            if (otherProc >= 0) {
                await send(fmtProcedimiento(PROCEDIMIENTOS[otherProc]));
                await setSelection(21, 'PROC', PROCEDIMIENTOS[otherProc].id, `INFO_${PROCEDIMIENTOS[otherProc].id.toUpperCase()}`);
                return;
            }
            // Preguntas comunes
            const faq = matchFAQ(cleanMsgOrig);
            if (faq) { await send(faq); await send('¿Te gustaría agendar tu cita?'); return; }
            if (isPriceQuery(cleanMsgOrig)) {
                await send('Dime específicamente de qué servicio, con gusto te doy el precio. 😊');
                return;
            }
            await send('¿Te gustaría agendar la cita? Responde *"sí"* para apartarla o *"menú"* para ver otras opciones.');
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 20 — Procedimientos, elegir
        // ═══════════════════════════════════════
        if (step === 20) {
            const num = parseInt(cleanMsgOrig, 10);
            let procIdx = -1;
            if (!isNaN(num) && num >= 1 && num <= PROCEDIMIENTOS.length) procIdx = num - 1;
            else procIdx = matchProcedureByText(cleanMsg);
            if (procIdx >= 0 && procIdx < PROCEDIMIENTOS.length) {
                const proc = PROCEDIMIENTOS[procIdx];
                await send(fmtProcedimiento(proc));
                await setSelection(21, 'PROC', proc.id, `INFO_${proc.id.toUpperCase()}`);
                return;
            }
            await send(`Escribe el *número* del procedimiento (1-${PROCEDIMIENTOS.length}) o *0* para volver.`);
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 21 — Info procedimiento, ¿agendar valoración?
        // ═══════════════════════════════════════
        if (step === 21) {
            if (isAccept(cleanMsgOrig)) {
                await send('¡Excelente! Para agendar tu valoración necesito tu *nombre completo*, por favor. ✏️');
                await updateStep(70);
                return;
            }
            if (isDecline(cleanMsgOrig)) {
                const msg = /lejos|distancia/i.test(cleanMsgOrig) ? CIERRE_SIN_VENTA_DISTANCIA : CIERRE_SIN_VENTA;
                await send(msg);
                await escalate('CIERRE_SIN_VENTA');
                return;
            }
            const otherProc = matchProcedureByText(cleanMsg);
            if (otherProc >= 0) {
                await send(fmtProcedimiento(PROCEDIMIENTOS[otherProc]));
                await setSelection(21, 'PROC', PROCEDIMIENTOS[otherProc].id, `INFO_${PROCEDIMIENTOS[otherProc].id.toUpperCase()}`);
                return;
            }
            const otherEsp = matchSpecialtyByText(cleanMsg);
            if (otherEsp >= 0) {
                const esp = ESPECIALIDADES[otherEsp];
                await send(fmtEspecialidad(esp));
                await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
                return;
            }
            const faq = matchFAQ(cleanMsgOrig);
            if (faq) { await send(faq); await send('¿Te gustaría agendar la valoración?'); return; }
            if (/que incluye|qué incluye/i.test(cleanMsgOrig)) {
                await send('El cirujano te explica en la valoración todo lo que incluye tu procedimiento y el costo final según tu caso.\n\n¿Te gustaría agendar tu valoración?');
                return;
            }
            await send('¿Te gustaría agendar la valoración? Responde *"sí"* o *"menú"* para ver otras opciones.');
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 30 — Lab/estudios menú
        // ═══════════════════════════════════════
        if (step === 30) {
            const num = parseInt(cleanMsgOrig, 10);
            if (!isNaN(num) && num >= 1 && num <= ESTUDIOS_CON_CITA.length) {
                const est = ESTUDIOS_CON_CITA[num - 1];
                await send(fmtEstudio(est));
                await setSelection(32, 'EST', est.id, `INFO_${est.id.toUpperCase()}`);
                return;
            }
            const estIdx = matchEstudioByText(cleanMsg);
            if (estIdx >= 0) {
                const est = ESTUDIOS_CON_CITA[estIdx];
                await send(fmtEstudio(est));
                await setSelection(32, 'EST', est.id, `INFO_${est.id.toUpperCase()}`);
                return;
            }
            await send('Escribe el *número* del estudio para más detalle, o *0* para volver al menú.');
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 32 — Info estudio, ¿agendar?
        // ═══════════════════════════════════════
        if (step === 32) {
            if (isAccept(cleanMsgOrig)) {
                const sel = getSelection(tags);
                const est = sel ? ESTUDIOS_CON_CITA.find(e => e.id === sel.id) : null;
                if (est?.asesorConfirma) {
                    await send('¡Listo! Un asesor te contactará para darte el costo, las indicaciones de preparación y agendar tu estudio.');
                    await escalate(`CITA_${est.id.toUpperCase()}`);
                    return;
                }
                await send('¡Perfecto! Para agendar tu estudio necesito tu *nombre completo*, por favor. ✏️');
                await updateStep(70);
                return;
            }
            if (isDecline(cleanMsgOrig)) {
                await send(CIERRE_SIN_VENTA);
                await escalate('CIERRE_SIN_VENTA');
                return;
            }
            const faq = matchFAQ(cleanMsgOrig);
            if (faq) { await send(faq); await send('¿Te gustaría agendar tu estudio?'); return; }
            await send('¿Te gustaría agendar el estudio? Responde *"sí"* o *"menú"* para ver otras opciones.');
            return;
        }

        // ═══════════════════════════════════════
        //  STEP 40 — Ubicación, ¿algo más?
        // ═══════════════════════════════════════
        if (step === 40) {
            if (cleanMsgOrig === '1' || cleanMsgOrig.includes('agendar') || cleanMsgOrig.includes('cita') || cleanMsgOrig.includes('especialidad')) {
                await sendEspecialidadPicker();
                return;
            }
            await sendMainMenu();
            return;
        }

        // ═══════════════════════════════════════
        //  STEPS 70-72 — Recolección de datos
        // ═══════════════════════════════════════

        // STEP 70: Esperando nombre completo
        if (step === 70) {
            const nombre = msgText.trim();
            // Validación: no acepta sólo números, mensajes muy cortos, o "cancelar"
            if (/cancelar|cancel|salir|atras|atrás/i.test(nombre)) {
                await sendMainMenu();
                return;
            }
            if (/^\d+$/.test(nombre) || nombre.length < 3) {
                await send('Necesito tu *nombre completo* (nombre y apellido). Por ejemplo: *María Pérez*.');
                return;
            }
            // Extrae solo primer nombre para el saludo (más natural)
            const primerNombre = nombre.split(' ')[0];
            const sel = getSelection(tags);
            const needsMinorInfo = sel && (
                (sel.type === 'ESP' && ESPECIALIDADES.find(e => e.id === sel.id)?.esMenor) ||
                (sel.type === 'PROC' && PROCEDIMIENTOS.find(p => p.id === sel.id)?.esMenor)
            );
            // Actualiza el nombre del lead si es "Cliente" o parece un nombre válido
            if (lead.nombre === 'Cliente' || lead.nombre.length < 3) {
                try { await query('UPDATE leads SET nombre = $1 WHERE id = $2', [nombre, lead.id]); } catch(e) {}
            }
            if (needsMinorInfo) {
                await send(`Gracias, ${primerNombre}. 👶 Como la cita es para un menor, necesito su *edad* y el *nombre de la mamá, papá o tutor*.`);
                await updateStep(71);
            } else {
                let horarioHint = '';
                if (sel?.type === 'ESP') {
                    const esp = ESPECIALIDADES.find(e => e.id === sel.id);
                    if (esp?.horario) horarioHint = `\n🕐 Recuerda: ${esp.horario}.`;
                }
                await send(`Gracias, ${primerNombre}. ¿Qué *día y horario* prefieres para tu cita?${horarioHint}`);
                await updateStep(72);
            }
            return;
        }

        // STEP 71: Esperando info de menor
        if (step === 71) {
            const sel = getSelection(tags);
            let horarioHint = '';
            if (sel?.type === 'ESP') {
                const esp = ESPECIALIDADES.find(e => e.id === sel.id);
                if (esp?.horario) horarioHint = ` (${esp.horario})`;
            }
            await send(`Gracias por la información. ¿Qué *día y horario* prefieres?${horarioHint}`);
            await updateStep(72);
            return;
        }

        // STEP 72: Esperando día/horario → cierre con venta
        if (step === 72) {
            await send(CIERRE_VENTA);
            const sel = getSelection(tags);
            let tag = 'CITA_AGENDADA';
            if (sel) tag = `CITA_${sel.id.toUpperCase()}`;
            await escalate(tag);
            return;
        }

        // ═══════════════════════════════════════
        //  Fallback
        // ═══════════════════════════════════════
        const espIdx = matchSpecialtyByText(cleanMsg);
        if (espIdx >= 0) {
            const esp = ESPECIALIDADES[espIdx];
            await send(fmtEspecialidad(esp));
            await setSelection(esp.sinCita ? 1 : 11, 'ESP', esp.id, `INFO_${esp.id.toUpperCase()}`);
            return;
        }

        await send('Gracias por contactarnos. Permíteme confirmarlo con un asesor y en breve te respondemos.');
        await escalate('CONSULTA_GENERAL');

    } catch (err) {
        log(`ERROR: ${err.message}\n${err.stack}`);
    }
};

// ═══════════════════════════════════════════════════════════════
//  WhatsApp (Baileys) handler
// ═══════════════════════════════════════════════════════════════

const handleWhatsAppMessage = async (accountId, sock, msg) => {
    if (!msg.message || msg.message.protocolMessage) return;
    const jid = msg.key.remoteJid;
    const contactName = msg.pushName || 'Cliente';
    const isFromMe = msg.key.fromMe || false;

    let innerMessage = msg.message;
    if (innerMessage?.ephemeralMessage?.message) innerMessage = innerMessage.ephemeralMessage.message;
    else if (innerMessage?.viewOnceMessage?.message) innerMessage = innerMessage.viewOnceMessage.message;
    else if (innerMessage?.viewOnceMessageV2?.message?.imageMessage) innerMessage = innerMessage.viewOnceMessageV2.message;
    else if (innerMessage?.documentWithCaptionMessage?.message) innerMessage = innerMessage.documentWithCaptionMessage.message;
    else if (innerMessage?.editedMessage?.message) innerMessage = innerMessage.editedMessage.message;

    let msgText = msg.message?.conversation || innerMessage?.conversation || innerMessage?.extendedTextMessage?.text ||
        innerMessage?.imageMessage?.caption || innerMessage?.videoMessage?.caption || innerMessage?.documentMessage?.caption ||
        innerMessage?.buttonsResponseMessage?.selectedButtonId || innerMessage?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        innerMessage?.templateButtonReplyMessage?.selectedId || innerMessage?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '';

    let msgType = 'text';
    if (!msgText) {
        if (innerMessage?.documentMessage || innerMessage?.documentWithCaptionMessage) { msgText = '[Documento PDF adjunto]'; msgType = 'document'; }
        else if (innerMessage?.imageMessage) { msgText = '[Imagen adjunta]'; msgType = 'image'; }
        else if (innerMessage?.videoMessage) { msgText = '[Video adjunto]'; msgType = 'video'; }
        else if (innerMessage?.audioMessage) { msgText = '[Audio adjunto]'; msgType = 'audio'; }
    }

    if (msgType !== 'text') {
        try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: console });
            const ext = msgType === 'image' ? 'jpg' : msgType === 'video' ? 'mp4' : msgType === 'audio' ? 'ogg' : 'pdf';
            let origName = '';
            if (msgType === 'document') {
                const docMsg = innerMessage?.documentMessage || innerMessage?.documentWithCaptionMessage?.message?.documentMessage;
                origName = docMsg?.fileName ? `-${docMsg.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}` : '';
            }
            const filename = `media_${accountId}_${Date.now()}${origName}.${ext}`;
            fs.writeFileSync(path.join(uploadDir, filename), buffer);
            msgText = filename;
        } catch (err) { console.error('Error downloading media:', err); msgText = `[Error al descargar ${msgType}]`; msgType = 'text'; }
    }

    if (!msgText) return;
    if (jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.includes('broadcast')) return;

    handleUnifiedMessage(accountId, jid, contactName, msgText, 'baileys', msgType, isFromMe).catch(err => {
        console.error(`[Baileys:${accountId}] Error:`, err);
    });
};

module.exports = { handleWebhookVerification, handleIncomingMessage, handleWhatsAppMessage, saveMessage };
