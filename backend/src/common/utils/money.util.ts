import { BadRequestException } from '@nestjs/common';
import { errorBody } from './error-body.util';

/**
 * The one currency list (it used to be declared five times). A clinic works
 * in one currency (D3); invoices and payments must match it.
 */
export enum Currency {
    AMD = 'AMD',
    USD = 'USD',
    RUB = 'RUB',
}

/** Decimal places in practice. Armenian dram has no coins in use. */
export const MINOR_DIGITS: Record<Currency, number> = {
    [Currency.AMD]: 0,
    [Currency.USD]: 2,
    [Currency.RUB]: 2,
};

const factor = (currency: Currency) => 10 ** (MINOR_DIGITS[currency] ?? 2);

/**
 * Money is stored as integers in the smallest unit (D2): dram, cents,
 * kopecks. Floats summed in Mongo (`$inc`) drifted — 0.1 + 0.2 — and the
 * "pay the exact remaining balance" check then failed.
 *
 * Rejects amounts finer than the currency allows (12.345 USD, 100.5 AMD).
 */
export const toMinor = (amount: number, currency: Currency): number => {
    const scaled = amount * factor(currency);
    const rounded = Math.round(scaled);
    if (!Number.isFinite(amount) || Math.abs(scaled - rounded) > 1e-6) {
        throw new BadRequestException(
            errorBody('amountPrecision', `${amount} has more decimals than ${currency} allows`),
        );
    }
    return rounded;
};

export const toMajor = (minor: number, currency: Currency): number => (minor ?? 0) / factor(currency);

/** Rounds a computed minor-unit value (e.g. after a percentage discount) to a whole unit. */
export const roundMinor = (value: number): number => Math.round(value);
