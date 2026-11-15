import { base32Decode, base32Encode, newTotpSecret, otpauthUrl, totpAt, totpStep, verifyTotp } from './totp.util';

// RFC 6238 appendix B, SHA-1 key "12345678901234567890" (last 6 of the 8-digit codes).
const RFC_KEY = base32Encode(new TextEncoder().encode('12345678901234567890'));

describe('totp', () => {
    it('matches the RFC 6238 test vectors', () => {
        expect(totpAt(RFC_KEY, Math.floor(59 / 30), 8)).toBe('94287082');
        expect(totpAt(RFC_KEY, Math.floor(1111111109 / 30), 8)).toBe('07081804');
        expect(totpAt(RFC_KEY, Math.floor(1234567890 / 30), 8)).toBe('89005924');
        expect(totpAt(RFC_KEY, Math.floor(2000000000 / 30), 8)).toBe('69279037');
    });

    it('base32 round-trips', () => {
        const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
        expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
        expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
    });

    it('accepts the current code and one step of drift, nothing further', () => {
        const secret = newTotpSecret();
        const now = new Date('2026-11-15T10:00:10Z');
        const step = totpStep(now);
        expect(verifyTotp(secret, totpAt(secret, step), now)).toBe(step);
        expect(verifyTotp(secret, totpAt(secret, step - 1), now)).toBe(step - 1);
        expect(verifyTotp(secret, totpAt(secret, step + 1), now)).toBe(step + 1);
        expect(verifyTotp(secret, totpAt(secret, step - 2), now)).toBeNull();
        expect(verifyTotp(secret, '12345', now)).toBeNull();
        expect(verifyTotp(secret, 'abcdef', now)).toBeNull();
    });

    it('builds the otpauth link apps scan', () => {
        expect(otpauthUrl('DentFlow', 'anna@clinic.am', 'ABC')).toBe(
            'otpauth://totp/DentFlow%3Aanna%40clinic.am?secret=ABC&issuer=DentFlow&algorithm=SHA1&digits=6&period=30',
        );
    });
});
