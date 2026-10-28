/** Escapes user input so it matches literally inside a RegExp (no injection, no ReDoS). */
export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
