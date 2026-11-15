import { createHmac, randomBytes } from 'crypto';

/**
 * Time-based one-time codes (RFC 6238, SHA-1, 6 digits, 30 s), what every
 * authenticator app speaks (F9). Small enough to keep in-house.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(text: string): Uint8Array {
    const clean = text.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const i = ALPHABET.indexOf(ch);
        if (i < 0) throw new Error('Not base32');
        value = (value << 5) | i;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return new Uint8Array(out);
}

/** A new shared secret: 20 random bytes, base32 (what the QR code carries). */
export const newTotpSecret = (): string => base32Encode(new Uint8Array(randomBytes(20)));

/** The code for one time step. */
export function totpAt(secret: string, step: number, digits = TOTP_DIGITS): string {
    // 8-byte big-endian counter (plain bytes: Buffer typings clash with this TS version).
    const counter = new Uint8Array(8);
    new DataView(counter.buffer).setBigUint64(0, BigInt(step));
    const hmac = new Uint8Array(createHmac('sha1', base32Decode(secret)).update(counter).digest());
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(binary % 10 ** digits).padStart(digits, '0');
}

export const totpStep = (now: Date = new Date()) => Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);

/**
 * The time step a code belongs to, allowing one step of clock drift either
 * way, or `null`. Callers refuse a step at or before the last one used, so
 * a code works once.
 */
export function verifyTotp(secret: string, code: string, now: Date = new Date(), window = 1): number | null {
    const clean = String(code ?? '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return null;
    const current = totpStep(now);
    for (let d = -window; d <= window; d++) {
        if (totpAt(secret, current + d) === clean) return current + d;
    }
    return null;
}

/** What the QR code encodes: `otpauth://totp/DentFlow:anna@clinic.am?secret=…&issuer=DentFlow`. */
export const otpauthUrl = (issuer: string, account: string, secret: string) =>
    `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
