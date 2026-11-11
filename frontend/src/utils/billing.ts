import { Currency, PaymentMethod } from '../types';

/** Decimal places the API accepts per currency (mirrors the backend money.util). */
export const minorDigits = (currency: Currency | string) => (currency === 'AMD' ? 0 : 2);

/**
 * One invoice line, rounded like the server: whole minor units for the
 * discount, so the preview total equals the saved one.
 */
export const lineTotal = (quantity: number, unitPrice: number, discountPercent: number, digits: number) => {
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return { gross: 0, discount: 0, total: 0 };
    const scale = 10 ** digits;
    const grossMinor = Math.round(quantity * Math.round(unitPrice * scale));
    const discountMinor = Math.round((grossMinor * (discountPercent || 0)) / 100);
    return {
        gross: grossMinor / scale,
        discount: discountMinor / scale,
        total: (grossMinor - discountMinor) / scale,
    };
};

/** No finer than the currency allows (no half dram, no fractions of a cent). */
export const fitsCurrency = (amount: number, digits: number) => {
    const scaled = amount * 10 ** digits;
    return Number.isFinite(amount) && Math.abs(scaled - Math.round(scaled)) < 1e-6;
};

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer'];

export const paymentMethodKey = (method: PaymentMethod) =>
    `billing.${method === 'bank_transfer' ? 'bankTransfer' : method}`;
