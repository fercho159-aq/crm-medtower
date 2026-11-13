const crypto = require('crypto');
require('dotenv').config();

const verifyMetaSignature = (req, res, buf, encoding) => {
    const signature = req.headers['x-hub-signature-256'];

    if (!signature) {
        console.warn('No X-Hub-Signature-256 found on request');
        return;
    }

    const elements = signature.split('=');
    const signatureHash = elements[1];

    const expectedHash = crypto
        .createHmac('sha256', process.env.META_APP_SECRET || '')
        .update(buf)
        .digest('hex');

    if (signatureHash !== expectedHash) {
        throw new Error('Invalid signature. Could not verify request source.');
    }
};

const metaWebhookMiddleware = (req, res, next) => {
    next();
};

module.exports = {
    verifyMetaSignature,
    metaWebhookMiddleware
};
