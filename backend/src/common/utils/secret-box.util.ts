import { createCipheriv, createDecipheriv, createHash, createSecretKey, randomBytes } from 'crypto';

/**
 * Encryption for third-party credentials kept in the database (a clinic's
 * Telegram bot token, its SMS provider's auth token). A database dump alone
 * does not reveal them. The key comes from `SECRETS_KEY`; outside production
 * a fixed development key is used so local setups need nothing.
 */
const keyFor = (purpose: string) => {
    const secret = process.env.SECRETS_KEY;
    if (!secret && process.env.MODE === 'PROD') throw new Error('SECRETS_KEY must be set when MODE=PROD');
    // Plain Uint8Arrays: this @types/node's Buffer doesn't satisfy TypeScript 5.9's crypto signatures.
    return createSecretKey(new Uint8Array(createHash('sha256').update(`${secret || 'dev-secrets-key'}:${purpose}`).digest()));
};
const bytes = (b64url: string) => new Uint8Array(Buffer.from(b64url, 'base64url'));

/** AES-256-GCM, as `iv.tag.ciphertext` in base64url. */
export const sealSecret = (plain: string, purpose: string): string => {
    const iv = randomBytes(12).toString('base64url');
    const cipher = createCipheriv('aes-256-gcm', keyFor(purpose), bytes(iv));
    const data = cipher.update(plain, 'utf8', 'base64url') + cipher.final('base64url');
    return [iv, cipher.getAuthTag().toString('base64url'), data].join('.');
};

/** `null` when the value is missing or was sealed with another key. */
export const openSecret = (sealed: string | undefined | null, purpose: string): string | null => {
    if (!sealed) return null;
    try {
        const [iv, tag, data] = sealed.split('.');
        const decipher = createDecipheriv('aes-256-gcm', keyFor(purpose), bytes(iv));
        decipher.setAuthTag(bytes(tag));
        return decipher.update(data, 'base64url', 'utf8') + decipher.final('utf8');
    } catch {
        return null;
    }
};
