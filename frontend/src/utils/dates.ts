import { format } from 'date-fns';

/**
 * `YYYY-MM-DD` of `date` on the user's own calendar — for date inputs, "today"
 * and `max` limits.
 *
 * Never use `toISOString().slice(0, 10)` for this: that is the UTC date, which
 * in Yerevan (UTC+4) is still yesterday until 04:00, so "today" could not be
 * picked and new records were dated the day before.
 */
export const toLocalDateString = (date: Date = new Date()): string => format(date, 'yyyy-MM-dd');
