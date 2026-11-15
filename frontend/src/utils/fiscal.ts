/** F10: must match FISCAL_NUMBER in backend/src/modules/billing/dto/fiscal.dto.ts. */
export const FISCAL_NUMBER = /^[0-9A-Za-z][0-9A-Za-z\-/ ]{0,39}$/;

/** Trim and collapse spaces, as the server does. */
export const cleanFiscalNumber = (value: string): string => value.trim().replace(/\s+/g, ' ');
