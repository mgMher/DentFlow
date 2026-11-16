import { ChipProps } from '@mui/material';
import { ClinicState } from '../types';

/** F13: shared by the platform console and the clinic's own banners. */

export const CLINIC_STATES: ClinicState[] = ['active', 'trial', 'ending', 'ended', 'suspended'];

export const CLINIC_STATE_COLORS: Record<ClinicState, ChipProps['color']> = {
    active: 'success',
    trial: 'info',
    ending: 'warning',
    ended: 'error',
    suspended: 'default',
};

export const clinicStateKey = (state: ClinicState) => `platform.state.${state}`;

/** "Ending" this many days before the end, as on the server; admins are warned from then. */
export const ENDING_DAYS = 7;

/**
 * The server stores the end as the moment access stops (midnight after the
 * last day); people think of the last day itself.
 */
export const lastDayOf = (expiresAt: string | Date) => new Date(new Date(expiresAt).getTime() - 1);

/** Whole days until access stops (0 on the last day). */
export const daysLeft = (expiresAt: string | Date, now = new Date()) =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));

export const hasEnded = (expiresAt?: string | null, now = new Date()) => !!expiresAt && new Date(expiresAt) <= now;
export const isEnding = (expiresAt?: string | null, now = new Date()) =>
    !!expiresAt && !hasEnded(expiresAt, now) && new Date(expiresAt).getTime() - now.getTime() <= ENDING_DAYS * 86_400_000;

const dayInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The last day, as the date field wants it. */
export const lastDayInput = (expiresAt?: string) => (expiresAt ? dayInput(lastDayOf(expiresAt)) : '');

/** `days` after the last day (or after today, when it already ended), for the date field. */
export const shiftLastDay = (expiresAt: string | undefined, days: number) => {
    const base = expiresAt && !hasEnded(expiresAt) ? lastDayOf(expiresAt) : new Date();
    return dayInput(new Date(base.getTime() + days * 86_400_000));
};

export const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

export const SUPPORT_HOURS = [1, 4, 24, 72] as const;
