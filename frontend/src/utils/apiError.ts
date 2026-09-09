import i18n from '../locales/i18n';

/**
 * Turns an API failure into a message the user can read in their own language.
 *
 * The API sends a stable `code` alongside its English `message` (see
 * `errorBody` in the backend services). We translate the code when we have a
 * string for it, and fall back to the server's message — then to a generic
 * key — so nothing ever surfaces as "undefined".
 */
export const apiErrorMessage = (err: any, fallbackKey = 'toast.saveError'): string => {
    const body = err?.data ?? err?.response?.data;
    const code = body?.code;

    if (code) {
        const key = `errors.${code}`;
        const translated = i18n.t(key);
        if (translated !== key) {
            return translated;
        }
    }

    const message = body?.message;
    if (typeof message === 'string' && message) {
        return message;
    }
    if (Array.isArray(message) && message.length) {
        return message.join(', ');
    }

    return i18n.t(fallbackKey);
};
