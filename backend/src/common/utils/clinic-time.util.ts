/**
 * Date maths in the clinic's timezone.
 *
 * The server runs in UTC, but a clinic's "today", "this month" and "09:00"
 * are Yerevan wall-clock times. `new Date('2026-10-01')` is UTC midnight, i.e.
 * 04:00 in Yerevan, so every date filter built that way dropped the first four
 * hours of the day and every availability slot was four hours late.
 *
 * Built on `Intl` only, so it follows the IANA rules (DST included) without a
 * date library. Day ranges are half-open: `start <= t < end`.
 */

export const DEFAULT_CLINIC_TIMEZONE = 'Asia/Yerevan';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (timeZone: string) => {
    let fmt = formatterCache.get(timeZone);
    if (!fmt) {
        fmt = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        formatterCache.set(timeZone, fmt);
    }
    return fmt;
};

/** Wall-clock fields of `instant` as seen in `timeZone`. */
const wallClock = (instant: Date, timeZone: string) => {
    const parts = partsFormatter(timeZone).formatToParts(instant);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute'),
        second: get('second'),
    };
};

/** How far `timeZone` is ahead of UTC at `instant`, in ms. */
const offsetAt = (instant: Date, timeZone: string): number => {
    const w = wallClock(instant, timeZone);
    const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of `instant` on the clinic's calendar. */
export const toClinicDateString = (instant: Date, timeZone: string): string => {
    const w = wallClock(instant, timeZone);
    return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
};

/** `HH:mm` of `instant` on the clinic's clock. */
export const toClinicTimeString = (instant: Date, timeZone: string): string => {
    const w = wallClock(instant, timeZone);
    return `${pad(w.hour)}:${pad(w.minute)}`;
};

/** Day of week (0 = Sunday) of a `YYYY-MM-DD` calendar date. */
export const weekdayOf = (date: string): number => {
    const d = DATE_RE.exec(date);
    if (!d) throw new Error(`Expected YYYY-MM-DD, got "${date}"`);
    return new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])).getUTCDay();
};

/** The instant at which the clinic's clock shows `date` `time` (`YYYY-MM-DD`, `HH:mm`). */
export const clinicTimeToUtc = (date: string, time: string, timeZone: string): Date => {
    const d = DATE_RE.exec(date);
    const t = TIME_RE.exec(time);
    if (!d || !t) {
        throw new Error(`Expected YYYY-MM-DD and HH:mm, got "${date}" "${time}"`);
    }
    const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
    // Two passes: the offset at the guessed instant can differ from the
    // offset at the answer when a DST change falls between them.
    const first = guess - offsetAt(new Date(guess), timeZone);
    return new Date(guess - offsetAt(new Date(first), timeZone));
};

/** `YYYY-MM-DD` shifted by `days` (calendar arithmetic, no timezone involved). */
export const addDays = (date: string, days: number): string => {
    const d = DATE_RE.exec(date);
    if (!d) throw new Error(`Expected YYYY-MM-DD, got "${date}"`);
    const shifted = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3] + days));
    return shifted.toISOString().slice(0, 10);
};

/** The clinic day `date` as `[start, end)`. */
export const clinicDayRange = (date: string, timeZone: string): { start: Date; end: Date } => ({
    start: clinicTimeToUtc(date, '00:00', timeZone),
    end: clinicTimeToUtc(addDays(date, 1), '00:00', timeZone),
});

/**
 * `[start of fromDate, end of toDate)` for a "from – to" filter where both
 * days are included. Either bound may be omitted.
 */
export const clinicDateSpan = (
    fromDate: string | undefined,
    toDate: string | undefined,
    timeZone: string,
): { start?: Date; end?: Date } => ({
    start: fromDate ? clinicTimeToUtc(fromDate, '00:00', timeZone) : undefined,
    end: toDate ? clinicTimeToUtc(addDays(toDate, 1), '00:00', timeZone) : undefined,
});

/** Today on the clinic's calendar, as `[start, end)`. */
export const clinicToday = (timeZone: string, now: Date = new Date()) =>
    clinicDayRange(toClinicDateString(now, timeZone), timeZone);

/** The clinic's current month, as `[start, end)`. */
export const clinicMonth = (timeZone: string, now: Date = new Date()) => {
    const [year, month] = toClinicDateString(now, timeZone).split('-').map(Number);
    const first = `${year}-${pad(month)}-01`;
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
    return { start: clinicTimeToUtc(first, '00:00', timeZone), end: clinicTimeToUtc(next, '00:00', timeZone) };
};
