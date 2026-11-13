const parseBool = (v, def = true) => {
    if (v === undefined || v === null || v === '') return def;
    return !['false', '0', 'no', 'off'].includes(String(v).trim().toLowerCase());
};

const features = {
    LEADS: true, DASHBOARD: true, AUTH: true,
    WHATSAPP:         parseBool(process.env.FEATURE_WHATSAPP, true),
    BOT:              parseBool(process.env.FEATURE_BOT, true),
    PARRILLA:         parseBool(process.env.FEATURE_PARRILLA, false),
    INSTAGRAM:        parseBool(process.env.FEATURE_INSTAGRAM, false),
    KPIS:             parseBool(process.env.FEATURE_KPIS, true),
    MULTI_VENDEDOR:   parseBool(process.env.FEATURE_MULTI_VENDEDOR, true),
    CRON_SEGUIMIENTO: parseBool(process.env.FEATURE_CRON_SEGUIMIENTO, true),

    BRAND_NAME:       process.env.BRAND_NAME || 'MIT Medical Tower',
    BRAND_TIMEZONE:   process.env.BRAND_TIMEZONE || 'America/Mexico_City',
    BRAND_COUNTRY:    process.env.BRAND_COUNTRY || 'MX',
    BRAND_CURRENCY:   process.env.BRAND_CURRENCY || 'MXN',
    BRAND_PHONE_DISPLAY: process.env.BRAND_PHONE_DISPLAY || '+52 55 2838 0715',
};

module.exports = features;
