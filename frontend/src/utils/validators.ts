/**
 * Armenian phone numbers.
 *
 * The national significant number is always 8 digits after the +374 country
 * code (2-digit operator/area code + 6 subscriber digits), which is the same as
 * the 9-digit local form starting with a trunk `0`.
 *
 *   accepted:  +374 93 12 34 56 | 093 123456 | 093-12-34-56 | 93123456
 *   canonical: +37493123456
 */
export const ARMENIAN_PHONE_E164 = /^\+374\d{8}$/;

/** Digits only, so the field can be typed with spaces, dashes and parentheses. */
export const normalizeArmenianPhone = (value: string): string => {
    if (!value) return '';

    const digits = value.replace(/\D/g, '');

    if (digits.length === 13 && digits.startsWith('00374')) return `+374${digits.slice(5)}`;
    if (digits.length === 11 && digits.startsWith('374')) return `+374${digits.slice(3)}`;
    if (digits.length === 9 && digits.startsWith('0')) return `+374${digits.slice(1)}`;
    if (digits.length === 8) return `+374${digits}`;

    return value.trim();
};

export const isArmenianPhone = (value: string): boolean =>
    ARMENIAN_PHONE_E164.test(normalizeArmenianPhone(value));

/** `+37493123456` → `+374 93 12 34 56` for display and for prefilled inputs. */
export const formatArmenianPhone = (value: string): string => {
    const normalized = normalizeArmenianPhone(value || '');
    if (!ARMENIAN_PHONE_E164.test(normalized)) return value || '';

    const n = normalized.slice(4);
    return `+374 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)}`;
};

export const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/** Largest photo we are willing to send to the API (~1.5MB of base64). */
export const MAX_PHOTO_DATA_URL_LENGTH = 2_000_000;
