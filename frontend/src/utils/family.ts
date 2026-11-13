import { GuardianRelationship } from '../types';
import { toLocalDateString } from './dates';

export const RELATIONSHIPS: GuardianRelationship[] = ['mother', 'father', 'grandparent', 'sibling', 'guardian', 'other'];
export const ADULT_AGE = 18;

/** Full years on `today`, by calendar date (as the server counts). */
export const ageOn = (dateOfBirth: string, today = toLocalDateString()): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(dateOfBirth ?? '')) return null;
    const [by, bm, bd] = dateOfBirth.slice(0, 10).split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    let age = ty - by;
    if (tm < bm || (tm === bm && td < bd)) age--;
    return age;
};

export const isMinor = (dateOfBirth?: string | null) => {
    const age = dateOfBirth ? ageOn(dateOfBirth) : null;
    return age !== null && age >= 0 && age < ADULT_AGE;
};
