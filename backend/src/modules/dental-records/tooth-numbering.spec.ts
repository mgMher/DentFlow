import { ADULT_TEETH, PEDIATRIC_TEETH, isFdiTooth, universalToFdi } from './tooth-numbering';

describe('tooth-numbering', () => {
    it('lists 32 permanent and 20 primary FDI teeth', () => {
        expect(ADULT_TEETH).toHaveLength(32);
        expect(PEDIATRIC_TEETH).toHaveLength(20);
        expect(ADULT_TEETH.slice(0, 3)).toEqual([11, 12, 13]);
        expect(PEDIATRIC_TEETH.slice(-2)).toEqual([84, 85]);
    });

    it('accepts FDI numbers only', () => {
        expect(isFdiTooth(11)).toBe(true);
        expect(isFdiTooth(48)).toBe(true);
        expect(isFdiTooth(85)).toBe(true);
        expect(isFdiTooth(19)).toBe(false);
        expect(isFdiTooth(56)).toBe(false);
        expect(isFdiTooth(1)).toBe(false);
        expect(isFdiTooth('11')).toBe(false);
    });

    it('maps Universal permanent teeth', () => {
        expect(universalToFdi(1)).toBe(18); // upper right third molar
        expect(universalToFdi(8)).toBe(11); // upper right central incisor
        expect(universalToFdi(9)).toBe(21);
        expect(universalToFdi(16)).toBe(28);
        expect(universalToFdi(17)).toBe(38); // lower left third molar
        expect(universalToFdi(24)).toBe(31);
        expect(universalToFdi(25)).toBe(41);
        expect(universalToFdi(32)).toBe(48);
    });

    it('maps Universal primary teeth (A–T stored as 51–70)', () => {
        expect(universalToFdi(51)).toBe(55); // A: upper right second molar
        expect(universalToFdi(55)).toBe(51); // E: upper right central
        expect(universalToFdi(56)).toBe(61); // F
        expect(universalToFdi(60)).toBe(65); // J
        expect(universalToFdi(61)).toBe(75); // K: lower left second molar
        expect(universalToFdi(65)).toBe(71); // O
        expect(universalToFdi(66)).toBe(81); // P
        expect(universalToFdi(70)).toBe(85); // T
    });

    it('is a one-to-one mapping', () => {
        const adult = Array.from({ length: 32 }, (_, i) => universalToFdi(i + 1));
        const primary = Array.from({ length: 20 }, (_, i) => universalToFdi(i + 51));
        expect(new Set(adult)).toEqual(new Set(ADULT_TEETH));
        expect(new Set(primary)).toEqual(new Set(PEDIATRIC_TEETH));
        expect(universalToFdi(0)).toBeNull();
        expect(universalToFdi(40)).toBeNull();
    });
});
