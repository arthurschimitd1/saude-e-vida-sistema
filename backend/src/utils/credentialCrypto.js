import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

function getKey() {
    const secret = process.env.WHATSAPP_CREDENTIALS_KEY || process.env.JWT_SECRET;
    if (!secret) throw new Error('Chave de criptografia das integrações não configurada');
    return crypto.createHash('sha256').update(secret).digest();
}

export function encryptCredential(value) {
    if (!value) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptCredential(value) {
    if (!value) return null;
    const [ivHex, tagHex, encryptedHex] = String(value).split(':');
    if (!ivHex || !tagHex || !encryptedHex) throw new Error('Credencial criptografada inválida');
    const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ]).toString('utf8');
}
