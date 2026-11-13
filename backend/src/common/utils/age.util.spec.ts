import { ageOn, isMinor } from './age.util';

describe('ageOn / isMinor', () => {
    it('counts full years by calendar date', () => {
        expect(ageOn('2008-11-13', '2026-11-12')).toBe(17);
        expect(ageOn('2008-11-13', '2026-11-13')).toBe(18);
        expect(ageOn(new Date('2010-01-01T00:00:00Z'), '2026-11-13')).toBe(16);
    });

    it('turns 18 on the birthday, not a day before', () => {
        expect(isMinor('2008-11-14', '2026-11-13')).toBe(true);
        expect(isMinor('2008-11-13', '2026-11-13')).toBe(false);
    });

    it('a 29 February birthday counts from 1 March in other years', () => {
        expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
        expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
    });

    it('no birth date: not a minor', () => {
        expect(isMinor(undefined, '2026-11-13')).toBe(false);
    });
});
