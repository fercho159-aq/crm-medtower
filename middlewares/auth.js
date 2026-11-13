const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
};

const verifyCronApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey || apiKey !== process.env.API_KEY_CRON) {
        return res.status(403).json({ error: 'Forbidden. Invalid API Key.' });
    }
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    verifyCronApiKey
};
