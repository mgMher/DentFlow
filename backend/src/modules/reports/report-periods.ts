import { addDays, weekdayOf } from 'src/common/utils';

/**
 * Calendar periods for report charts. Every date here is a clinic calendar
 * day (`YYYY-MM-DD`); turning them into instants is `clinicDateSpan`'s job.
 */

export const REPORT_GROUP_BY = ['day', 'week', 'month'] as const;
export type ReportGroupBy = (typeof REPORT_GROUP_BY)[number];

/** Whole days from `from` to `to` (0 when equal). */
export const daysBetween = (from: string, to: string): number =>
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** First day of the period holding `date`. Weeks start on Monday (ISO), like `$dateTrunc` with `startOfWeek: 'monday'`. */
export const periodStart = (date: string, groupBy: ReportGroupBy): string => {
    if (groupBy === 'month') return `${date.slice(0, 7)}-01`;
    if (groupBy === 'week') return addDays(date, -((weekdayOf(date) + 6) % 7));
    return date;
};

const nextPeriod = (start: string, groupBy: ReportGroupBy): string => {
    if (groupBy === 'day') return addDays(start, 1);
    if (groupBy === 'week') return addDays(start, 7);
    const [year, month] = start.split('-').map(Number);
    return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
};

/**
 * Start of every period from the one holding `from` to the one holding `to`,
 * so a chart shows empty days as zero instead of skipping them.
 * Stops at `limit` + 1 entries, enough for the caller to see the range is too long.
 */
export const periodStarts = (from: string, to: string, groupBy: ReportGroupBy, limit = 1000): string[] => {
    const out: string[] = [];
    for (let p = periodStart(from, groupBy); p <= to && out.length <= limit; p = nextPeriod(p, groupBy)) {
        out.push(p);
    }
    return out;
};
