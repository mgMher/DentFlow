import { daysBetween, periodStart, periodStarts } from './report-periods';

describe('report periods', () => {
    it('finds the start of a day, ISO week and month', () => {
        expect(periodStart('2026-10-29', 'day')).toBe('2026-10-29');
        expect(periodStart('2026-10-29', 'week')).toBe('2026-10-26'); // Thursday -> Monday
        expect(periodStart('2026-10-26', 'week')).toBe('2026-10-26');
        expect(periodStart('2026-11-01', 'week')).toBe('2026-10-26'); // Sunday belongs to the week before
        expect(periodStart('2026-10-29', 'month')).toBe('2026-10-01');
    });

    it('lists every period in the range, both ends included', () => {
        expect(periodStarts('2026-10-30', '2026-11-02', 'day')).toEqual([
            '2026-10-30',
            '2026-10-31',
            '2026-11-01',
            '2026-11-02',
        ]);
        expect(periodStarts('2026-10-29', '2026-11-10', 'week')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
        expect(periodStarts('2026-11-15', '2027-02-01', 'month')).toEqual([
            '2026-11-01',
            '2026-12-01',
            '2027-01-01',
            '2027-02-01',
        ]);
    });

    it('stops one past the limit', () => {
        expect(periodStarts('2020-01-01', '2026-01-01', 'day', 10)).toHaveLength(11);
    });

    it('counts days across a month end', () => {
        expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
        expect(daysBetween('2026-10-30', '2026-10-30')).toBe(0);
    });
});
