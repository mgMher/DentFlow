import { summarizePerio } from './perio-summary';

const site = (pd: number | null, rec: number | null = null, bop = false, plaque = false) => ({ pd, rec, bop, sup: false, plaque });

describe('summarizePerio', () => {
    it('an empty exam has counts but no averages', () => {
        const s = summarizePerio([{ sites: [] }, { missing: true, sites: [] }]);
        expect(s).toMatchObject({ teeth: 1, sitesProbed: 0, meanPd: null, meanCal: null, bopPercent: null, sites4plus: 0 });
    });

    it('averages depths and attachment loss; scores bleeding and plaque over all sites of present teeth', () => {
        const s = summarizePerio([
            { mobility: 1, furcation: 2, sites: [site(3, 1, true), site(2), site(4, 0, true, true), site(6, 2), site(2), site(3)] },
            { sites: [site(2, -1), site(2), site(2), site(2), site(2), site(2, null, false, true)] },
            // A missing tooth counts for nothing, whatever was typed on it.
            { missing: true, mobility: 3, sites: [site(9, 0, true), site(9), site(9), site(9), site(9), site(9)] },
        ]);
        expect(s.teeth).toBe(2);
        expect(s.sitesProbed).toBe(12);
        expect(s.meanPd).toBe(2.7); // 32 / 12
        expect(s.meanCal).toBe(4.3); // (4 + 4 + 8 + 1) / 4 — only sites with both figures
        expect(s.bopPercent).toBe(16.7); // 2 of 12
        expect(s.plaquePercent).toBe(16.7);
        expect(s).toMatchObject({ sites4plus: 2, sites6plus: 1, mobileTeeth: 1, furcationTeeth: 1 });
    });
});
