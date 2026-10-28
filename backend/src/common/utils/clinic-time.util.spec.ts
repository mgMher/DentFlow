import {
    addDays,
    clinicDateSpan,
    clinicDayRange,
    clinicMonth,
    clinicTimeToUtc,
    clinicToday,
    toClinicDateString,
} from './clinic-time.util';

const YEREVAN = 'Asia/Yerevan'; // UTC+4, no DST
const BERLIN = 'Europe/Berlin'; // DST on 2026-03-29 and 2026-10-25

describe('clinic-time', () => {
    it('converts Yerevan wall-clock time to UTC', () => {
        expect(clinicTimeToUtc('2026-10-01', '09:00', YEREVAN).toISOString()).toBe('2026-10-01T05:00:00.000Z');
        expect(clinicTimeToUtc('2026-10-01', '00:00', YEREVAN).toISOString()).toBe('2026-09-30T20:00:00.000Z');
    });

    it('handles both sides of a DST change', () => {
        expect(clinicTimeToUtc('2026-10-24', '12:00', BERLIN).toISOString()).toBe('2026-10-24T10:00:00.000Z');
        expect(clinicTimeToUtc('2026-10-26', '12:00', BERLIN).toISOString()).toBe('2026-10-26T11:00:00.000Z');
    });

    it('gives the clinic date, not the UTC date, early in the morning', () => {
        // 02:30 in Yerevan is still the previous day in UTC.
        expect(toClinicDateString(new Date('2026-10-01T22:30:00Z'), YEREVAN)).toBe('2026-10-02');
    });

    it('builds a half-open day range', () => {
        const { start, end } = clinicDayRange('2026-10-01', YEREVAN);
        expect(start.toISOString()).toBe('2026-09-30T20:00:00.000Z');
        expect(end.toISOString()).toBe('2026-10-01T20:00:00.000Z');
    });

    it('includes the whole last day of a span', () => {
        const { start, end } = clinicDateSpan('2026-10-01', '2026-10-31', YEREVAN);
        expect(start?.toISOString()).toBe('2026-09-30T20:00:00.000Z');
        expect(end?.toISOString()).toBe('2026-10-31T20:00:00.000Z');
        expect(clinicDateSpan(undefined, undefined, YEREVAN)).toEqual({ start: undefined, end: undefined });
    });

    it('computes today and this month from "now"', () => {
        const now = new Date('2026-12-31T21:00:00Z'); // 01:00 on Jan 1st in Yerevan
        expect(clinicToday(YEREVAN, now).start.toISOString()).toBe('2026-12-31T20:00:00.000Z');
        expect(clinicMonth(YEREVAN, now).start.toISOString()).toBe('2026-12-31T20:00:00.000Z');
        expect(clinicMonth(YEREVAN, now).end.toISOString()).toBe('2027-01-31T20:00:00.000Z');
    });

    it('does calendar arithmetic across month and year ends', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    });

    it('rejects malformed input', () => {
        expect(() => clinicTimeToUtc('01.10.2026', '09:00', YEREVAN)).toThrow();
        expect(() => clinicTimeToUtc('2026-10-01', '9am', YEREVAN)).toThrow();
    });
});
