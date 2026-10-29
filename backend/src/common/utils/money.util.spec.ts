import { BadRequestException } from '@nestjs/common';
import { Currency, toMajor, toMinor } from './money.util';

describe('money', () => {
    it('stores dram as whole units and dollars/roubles as cents', () => {
        expect(toMinor(15000, Currency.AMD)).toBe(15000);
        expect(toMinor(12.5, Currency.USD)).toBe(1250);
        expect(toMinor(0.1, Currency.RUB) + toMinor(0.2, Currency.RUB)).toBe(30);
    });

    it('rejects amounts finer than the currency', () => {
        expect(() => toMinor(100.5, Currency.AMD)).toThrow(BadRequestException);
        expect(() => toMinor(12.345, Currency.USD)).toThrow(BadRequestException);
        expect(() => toMinor(NaN, Currency.USD)).toThrow(BadRequestException);
    });

    it('accepts float noise from the client', () => {
        expect(toMinor(19.99, Currency.USD)).toBe(1999);
        expect(toMinor(1.1 + 2.2, Currency.USD)).toBe(330);
    });

    it('converts back', () => {
        expect(toMajor(1250, Currency.USD)).toBe(12.5);
        expect(toMajor(15000, Currency.AMD)).toBe(15000);
    });
});
