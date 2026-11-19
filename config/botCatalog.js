// ═══════════════════════════════════════════════════════════════
//  MIT Medical Tower — Catálogo del Bot (fuente única)
//  Los defaults viven aquí. Los overrides vienen de la BD
//  (tabla bot_settings, key = 'flow_mit_overrides') y se
//  aplican mutando este objeto en memoria.
// ═══════════════════════════════════════════════════════════════

const DEFAULTS = Object.freeze({
    ESPECIALIDADES: [
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
    ],
    ESTUDIOS_CON_CITA: [
        { id: 'doppler', nombre: 'Ultrasonido Doppler', area: 'Angiología', costo: 3000, anticipo: 1000, resto: 2000 },
        { id: 'holter', nombre: 'Holter', area: 'Cardiología', costo: 1500, anticipo: 500, resto: 1000, desc: 'monitoreo del ritmo del corazón' },
        { id: 'mapa', nombre: 'MAPA', area: 'Cardiología', costo: 1500, anticipo: 500, resto: 1000, desc: 'monitoreo de presión arterial 24h' },
        { id: 'ecocardiograma', nombre: 'Ecocardiograma', area: 'Cardiología', costo: 1500, anticipo: 500, resto: 1000, desc: 'ultrasonido del corazón' },
        { id: 'endoscopia', nombre: 'Endoscopia y colonoscopia', area: 'Gastroenterología', costo: null, anticipo: null, resto: null, asesorConfirma: true },
    ],
    LABORATORIO: [
        { id: 'quimica_6', nombre: 'Química sanguínea de 6 elementos', precio: 150 },
        { id: 'quimica_12', nombre: 'Química sanguínea de 12 elementos', precio: 300 },
        { id: 'quimica_27', nombre: 'Química sanguínea de 27 elementos', precio: 400 },
        { id: 'biometria', nombre: 'Biometría hemática completa', precio: 80 },
        { id: 'orina', nombre: 'Examen general de orina', precio: 60 },
        { id: 'glucosa', nombre: 'Toma de glucosa', precio: 50 },
        { id: 'presion', nombre: 'Toma de presión', precio: 20 },
        { id: 'aplicacion_med', nombre: 'Aplicación de medicamento', precio: 20, nota: 'Requiere receta médica' },
    ],
    PROCEDIMIENTOS: [
        { id: 'mommy_makeover', nombre: 'Mommy Makeover', desde: '$149,900', cat: 'estetica', aliases: ['mommy', 'mommy makeover'] },
        { id: 'abdominoplastia', nombre: 'Abdominoplastia', desde: '$109,900', cat: 'estetica', aliases: ['abdominoplastia', 'abdomen', 'panza'] },
        { id: 'implantes', nombre: 'Implantes mamarios', desde: '$60,000', cat: 'estetica', aliases: ['implantes', 'aumento de busto', 'senos', 'busto'] },
        { id: 'rinoplastia', nombre: 'Rinoplastia ultrasónica', desde: '$47,999', cat: 'estetica', aliases: ['rinoplastia', 'nariz'] },
        { id: 'circuncision', nombre: 'Circuncisión pediátrica', desde: '$22,999', cat: 'pediatrica', aliases: ['circuncision', 'circuncisión'], esMenor: true },
        { id: 'orquidopexia', nombre: 'Orquidopexia unilateral', desde: '$24,999', cat: 'pediatrica', aliases: ['orquidopexia', 'testiculo'], esMenor: true },
        { id: 'hernia', nombre: 'Hernia umbilical o inguinal por laparoscopía', desde: '$45,000', cat: 'hernia', aliases: ['hernia'] },
    ],
    CLINICA: {
        direccion: 'Blvd. Prados de Aragón 8B, Col. Prados de Aragón, Cd. Nezahualcóyotl, Estado de México, C.P. 57179',
        whatsapp: '55 2838 0715',
        web: 'medtower.com.mx',
        email: 'mitmedicalt@yahoo.com',
        horario: 'Lunes a domingo, de 9:00 a 21:00 horas',
        maps: 'https://maps.app.goo.gl/cPKQ7FqE3vj93rrw8',
    },
    MENSAJES: {
        SALUDO_MENU: '¡Hola! 👋 Gracias por escribir a *MIT Medical Tower*.\n¿En qué te puedo ayudar hoy?\n\n1️⃣ Agendar cita con especialista\n2️⃣ Cirugía y procedimientos\n3️⃣ Laboratorio y estudios\n4️⃣ Ubicación y horarios\n5️⃣ Hablar con un asesor\n\nO escríbeme directamente qué necesitas 😊',
        CIERRE_VENTA: '¡Perfecto! Un asesor de MIT confirmará la disponibilidad y te enviará los datos para pagar tu anticipo. Tu cita queda apartada al recibirlo.\n\n📍 Te esperamos en Blvd. Prados de Aragón 8B, Col. Prados de Aragón, Cd. Nezahualcóyotl.',
        CIERRE_SIN_VENTA: 'Entiendo perfectamente. En MIT Medical Tower nos preocupamos por la salud e integridad de todos nuestros pacientes. Por eso nuestros precios reflejan altos estándares de calidad, seguridad e higiene en cada consulta y procedimiento. Si más adelante decides atenderte con nosotros, aquí estaremos para ayudarte. ¡Cuídate mucho!',
        CIERRE_SIN_VENTA_DISTANCIA: 'Entiendo, sabemos que la distancia es importante. En MIT Medical Tower nos preocupamos por la salud e integridad de todos nuestros pacientes, y por eso cuidamos altos estándares de calidad, seguridad e higiene. Si en algún momento decides atenderte con nosotros, con gusto te recibimos en Blvd. Prados de Aragón 8B, Cd. Nezahualcóyotl.',
        EMERGENCIA: '⚠️ Si tienes una emergencia médica, acude de inmediato al servicio de urgencias más cercano o llama al *911*. Tu salud es lo primero.',
        CRISIS: 'Te escucho y me preocupo por ti. Por favor llama a la *Línea de la Vida: 800 911 2000*, es gratuita y está disponible las 24 horas. No estás solo/a. 💙',
        PEDIR_NOMBRE: '¡Perfecto! Para agendar tu cita necesito tu *nombre completo*, por favor. ✏️',
        PEDIR_NOMBRE_VALORACION: '¡Excelente! Para agendar tu valoración necesito tu *nombre completo*, por favor. ✏️',
        PEDIR_NOMBRE_ESTUDIO: '¡Perfecto! Para agendar tu estudio necesito tu *nombre completo*, por favor. ✏️',
        ESCALAR_ASESOR: '👤 ¡Entendido! Te comunicaremos con un asesor de MIT Medical Tower. Un momento por favor...',
    },
    PROMOCION: {
        activa_hasta: '2026-11-30T23:59:59',
        texto: '🎉 *Promoción:* Orquidopexia unilateral — paquete especial de *$24,999 con valoración gratis*. Válido hasta el 30 de noviembre.',
        aplica_a_procedimiento_id: 'orquidopexia',
    },
});

// Estructura mutable (deep clone de los defaults) que el bot consume.
// Las funciones applyOverrides/resetOverrides mutan ESTE objeto en sitio.
const live = JSON.parse(JSON.stringify(DEFAULTS));

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

// Merge non-destructivo: solo pisa campos presentes en override
function mergeInto(target, override) {
    if (!override || typeof override !== 'object') return;
    for (const key of Object.keys(override)) {
        const val = override[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            mergeInto(target[key], val);
        } else {
            target[key] = val;
        }
    }
}

// Overrides shape:
// {
//   especialidades: { medicina_general: { costo: 120, horario: '...' }, ... },
//   procedimientos: { orquidopexia: { desde: '$23,999' }, ... },
//   laboratorio:    { quimica_6: { precio: 160 }, ... },
//   estudios:       { holter: { costo: 1600 }, ... },
//   clinica:        { whatsapp: '55...' },
//   mensajes:       { CIERRE_VENTA: '...' },
//   promocion:      { activa_hasta: '...', texto: '...' },
// }
function applyOverrides(overrides) {
    if (!overrides) return;

    const overrideArray = (arr, map) => {
        if (!map) return;
        for (const item of arr) {
            if (map[item.id]) mergeInto(item, map[item.id]);
        }
    };

    overrideArray(live.ESPECIALIDADES, overrides.especialidades);
    overrideArray(live.PROCEDIMIENTOS, overrides.procedimientos);
    overrideArray(live.LABORATORIO, overrides.laboratorio);
    overrideArray(live.ESTUDIOS_CON_CITA, overrides.estudios);
    if (overrides.clinica) mergeInto(live.CLINICA, overrides.clinica);
    if (overrides.mensajes) mergeInto(live.MENSAJES, overrides.mensajes);
    if (overrides.promocion) mergeInto(live.PROMOCION, overrides.promocion);
}

function resetOverrides() {
    // Restaurar cada campo mutable a su default
    live.ESPECIALIDADES.length = 0;
    deepClone(DEFAULTS.ESPECIALIDADES).forEach(x => live.ESPECIALIDADES.push(x));
    live.PROCEDIMIENTOS.length = 0;
    deepClone(DEFAULTS.PROCEDIMIENTOS).forEach(x => live.PROCEDIMIENTOS.push(x));
    live.LABORATORIO.length = 0;
    deepClone(DEFAULTS.LABORATORIO).forEach(x => live.LABORATORIO.push(x));
    live.ESTUDIOS_CON_CITA.length = 0;
    deepClone(DEFAULTS.ESTUDIOS_CON_CITA).forEach(x => live.ESTUDIOS_CON_CITA.push(x));
    Object.keys(live.CLINICA).forEach(k => delete live.CLINICA[k]);
    Object.assign(live.CLINICA, deepClone(DEFAULTS.CLINICA));
    Object.keys(live.MENSAJES).forEach(k => delete live.MENSAJES[k]);
    Object.assign(live.MENSAJES, deepClone(DEFAULTS.MENSAJES));
    Object.keys(live.PROMOCION).forEach(k => delete live.PROMOCION[k]);
    Object.assign(live.PROMOCION, deepClone(DEFAULTS.PROMOCION));
}

function getPromocion() {
    const hoy = new Date();
    const hasta = new Date(live.PROMOCION.activa_hasta);
    if (hoy <= hasta) {
        return { activa: true, texto: live.PROMOCION.texto, aplica: live.PROMOCION.aplica_a_procedimiento_id };
    }
    return { activa: false };
}

// Estructura del flujo (steps + transiciones) para el diagrama.
// No es mutable desde la UI — refleja la lógica real del handleUnifiedMessage.
function getFlowTree() {
    return {
        nodos: [
            { id: 'step_0', tipo: 'inicio', step: 0, titulo: 'Saludo inicial', descripcion: 'Primera interacción o "hola". Detecta síntoma/especialidad/procedimiento o envía el menú.' },
            { id: 'step_1', tipo: 'menu', step: 1, titulo: 'Menú principal', descripcion: live.MENSAJES.SALUDO_MENU },
            { id: 'step_10', tipo: 'menu', step: 10, titulo: 'Selector de especialidad', descripcion: 'Lista numerada de las 19 especialidades.' },
            { id: 'step_11', tipo: 'info', step: 11, titulo: 'Info de especialidad', descripcion: 'Muestra costo/anticipo/horario de la especialidad y pregunta si desea agendar.' },
            { id: 'step_20', tipo: 'menu', step: 20, titulo: 'Selector de procedimiento', descripcion: 'Lista de cirugías con precio "desde".' },
            { id: 'step_21', tipo: 'info', step: 21, titulo: 'Info de procedimiento', descripcion: 'Muestra precio "desde" del procedimiento y pregunta si desea agendar valoración.' },
            { id: 'step_30', tipo: 'menu', step: 30, titulo: 'Menú laboratorio y estudios', descripcion: 'Labs sin cita + estudios con cita numerados.' },
            { id: 'step_32', tipo: 'info', step: 32, titulo: 'Info de estudio', descripcion: 'Muestra costo/anticipo del estudio y pregunta si desea agendar.' },
            { id: 'step_40', tipo: 'info', step: 40, titulo: 'Ubicación y horarios', descripcion: 'Dirección, horario, WhatsApp, Google Maps.' },
            { id: 'step_70', tipo: 'captura', step: 70, titulo: 'Pedir nombre completo', descripcion: 'Espera nombre + apellido del paciente.' },
            { id: 'step_71', tipo: 'captura', step: 71, titulo: 'Info de menor (pediátrico)', descripcion: 'Edad y nombre del tutor cuando la cita es para un menor.' },
            { id: 'step_72', tipo: 'captura', step: 72, titulo: 'Pedir día y horario', descripcion: 'Preferencia de fecha para la cita.' },
            { id: 'cierre_venta', tipo: 'cierre', step: 99, titulo: 'Cierre con venta', descripcion: live.MENSAJES.CIERRE_VENTA },
            { id: 'cierre_sin_venta', tipo: 'cierre_frio', step: 99, titulo: 'Cierre sin venta', descripcion: live.MENSAJES.CIERRE_SIN_VENTA },
            { id: 'cierre_distancia', tipo: 'cierre_frio', step: 99, titulo: 'Cierre por distancia', descripcion: live.MENSAJES.CIERRE_SIN_VENTA_DISTANCIA },
            { id: 'escalar_asesor', tipo: 'escalar', step: 99, titulo: 'Escalar a asesor humano', descripcion: live.MENSAJES.ESCALAR_ASESOR },
            { id: 'emergencia', tipo: 'alerta', step: 0, titulo: 'Emergencia médica', descripcion: live.MENSAJES.EMERGENCIA },
            { id: 'crisis', tipo: 'alerta', step: 0, titulo: 'Crisis emocional', descripcion: live.MENSAJES.CRISIS },
        ],
        aristas: [
            { from: 'step_0', to: 'step_1', label: 'saludo / sin match' },
            { from: 'step_0', to: 'step_11', label: 'detecta especialidad / síntoma' },
            { from: 'step_0', to: 'step_21', label: 'detecta procedimiento' },
            { from: 'step_0', to: 'emergencia', label: 'palabra de emergencia' },
            { from: 'step_0', to: 'crisis', label: 'crisis emocional' },
            { from: 'step_1', to: 'step_10', label: 'opción 1 / "cita"' },
            { from: 'step_1', to: 'step_20', label: 'opción 2 / "cirugía"' },
            { from: 'step_1', to: 'step_30', label: 'opción 3 / "lab"' },
            { from: 'step_1', to: 'step_40', label: 'opción 4 / "ubicación"' },
            { from: 'step_1', to: 'escalar_asesor', label: 'opción 5 / "asesor"' },
            { from: 'step_1', to: 'step_11', label: 'escribe especialidad/síntoma' },
            { from: 'step_1', to: 'step_21', label: 'escribe procedimiento' },
            { from: 'step_10', to: 'step_11', label: 'elige número' },
            { from: 'step_11', to: 'step_70', label: '"sí" (agendar)' },
            { from: 'step_11', to: 'cierre_sin_venta', label: '"no"' },
            { from: 'step_11', to: 'cierre_distancia', label: '"lejos / distancia"' },
            { from: 'step_11', to: 'escalar_asesor', label: 'esp. sin precio fijo' },
            { from: 'step_20', to: 'step_21', label: 'elige número' },
            { from: 'step_21', to: 'step_70', label: '"sí" (agendar valoración)' },
            { from: 'step_21', to: 'cierre_sin_venta', label: '"no"' },
            { from: 'step_30', to: 'step_32', label: 'elige estudio' },
            { from: 'step_32', to: 'step_70', label: '"sí" (agendar)' },
            { from: 'step_32', to: 'cierre_sin_venta', label: '"no"' },
            { from: 'step_40', to: 'step_10', label: '"agendar"' },
            { from: 'step_40', to: 'step_1', label: 'cualquier otro' },
            { from: 'step_70', to: 'step_71', label: 'especialidad/proc. pediátrico' },
            { from: 'step_70', to: 'step_72', label: 'adulto' },
            { from: 'step_71', to: 'step_72', label: 'datos del menor' },
            { from: 'step_72', to: 'cierre_venta', label: 'día y horario' },
        ],
    };
}

module.exports = {
    live,
    DEFAULTS,
    applyOverrides,
    resetOverrides,
    getPromocion,
    getFlowTree,
};
