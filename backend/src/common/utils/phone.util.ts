/**
 * Armenian phone numbers.
 *
 * A national significant number in Armenia is always 8 digits after the +374
 * country code (2-digit operator/area code + 6 subscriber digits), which is the
 * same thing as the 9-digit local form starting with a trunk `0`.
 *
 *   accepted:  +374 93 12 34 56 | 00374931234567? no | 093 123456 | 093-12-34-56
 *   stored as: +37493123456
 */
export const ARMENIAN_PHONE_E164 = /^\+374\d{8}$/;

/**
 * Strip formatting and convert any accepted Armenian input into the canonical
 * `+374XXXXXXXX` form. Returns the trimmed input unchanged when it is not a
 * recognisable Armenian number, so validation can reject it with a clear error.
 */
export function normalizeArmenianPhone(value: unknown): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }

    // Keep only digits, remembering whether the number was written with a `+`.
    const digits = trimmed.replace(/\D/g, '');

    // +374XXXXXXXX / 374XXXXXXXX / 00374XXXXXXXX
    if (digits.length === 11 && digits.startsWith('374')) {
        return `+374${digits.slice(3)}`;
    }
    if (digits.length === 13 && digits.startsWith('00374')) {
        return `+374${digits.slice(5)}`;
    }

    // 0XXXXXXXX (local trunk form)
    if (digits.length === 9 && digits.startsWith('0')) {
        return `+374${digits.slice(1)}`;
    }

    // XXXXXXXX (bare national significant number)
    if (digits.length === 8) {
        return `+374${digits}`;
    }

    return trimmed;
}

export const ARMENIAN_PHONE_MESSAGE =
    'must be a valid Armenian phone number, e.g. +374 93 123456 or 093 123456';
