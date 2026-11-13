const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
// Ensure the key is exactly 32 bytes. If not, this will throw an error or we can hash it.
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (ENCRYPTION_KEY && ENCRYPTION_KEY.length !== 32) {
    // If not exactly 32 bytes, we can hash it to make it 32 bytes, but better to enforce it.
    // Let's create a 32 byte buffer from the string, padded or truncated.
    ENCRYPTION_KEY = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
} else if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex').substr(0, 32);
}

const encrypt = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(12); // AES-GCM recommended IV size is 12 bytes
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

const decrypt = (encryptedText) => {
    if (!encryptedText) return null;
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) return null;
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        return null;
    }
};

module.exports = {
    encrypt,
    decrypt
};
