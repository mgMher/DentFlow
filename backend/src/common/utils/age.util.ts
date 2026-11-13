/** Ages by calendar date (F8): a child turns 18 on their birthday in the clinic's time zone. */

export const ADULT_AGE = 18;

/** `YYYY-MM-DD` of a birth date stored as midnight UTC (how date-only fields are saved). */
const birthDay = (dob: Date | string) => (typeof dob === 'string' ? dob : dob.toISOString()).slice(0, 10);

/** Full years on `today` (`YYYY-MM-DD`). A 29 February birthday counts from 1 March in other years. */
export function ageOn(dob: Date | string, today: string): number {
    const [by, bm, bd] = birthDay(dob).split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    let age = ty - by;
    if (tm < bm || (tm === bm && td < bd)) age--;
    return age;
}

export const isMinor = (dob: Date | string | null | undefined, today: string): boolean =>
    !!dob && ageOn(dob, today) < ADULT_AGE;
