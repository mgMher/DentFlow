import i18n from '../locales/i18n';
import { Appointment, AppointmentStatus, Treatment } from '../types';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
];

/**
 * Next statuses a person can pick. Mirrors TRANSITIONS in
 * backend/src/modules/appointments/appointments.service.ts; cancelling is a
 * separate action because it needs a reason.
 */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    scheduled: ['confirmed', 'in_progress', 'completed', 'no_show'],
    confirmed: ['scheduled', 'in_progress', 'completed', 'no_show'],
    in_progress: ['completed'],
    completed: [],
    cancelled: ['scheduled'],
    no_show: ['scheduled'],
};

export const CANCELLABLE: AppointmentStatus[] = ['scheduled', 'confirmed'];
export const EDITABLE: AppointmentStatus[] = ['scheduled', 'confirmed'];
/** Statuses that describe a visit that happened; the API refuses them more than 30 min before the start. */
export const NEEDS_STARTED: AppointmentStatus[] = ['in_progress', 'completed', 'no_show'];

export const CANCEL_REASONS = [
    'patient_request',
    'patient_illness',
    'clinic_rescheduled',
    'dentist_unavailable',
    'other',
] as const;

/** Translation key for a status. The locale files use camelCase (`inProgress`), the API snake_case. */
export const statusKey = (status: string) =>
    `appointments.${status.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`;

/** Catalogue name in the active UI language. */
export const localizedTreatmentName = (treatment: Pick<Treatment, 'name' | 'nameHy' | 'nameRu'>): string => {
    const lang = i18n.language;
    return (lang === 'hy' && treatment.nameHy) || (lang === 'ru' && treatment.nameRu) || treatment.name;
};

/** What to call an appointment: its title, else its treatments, else its old free-text type. */
export const appointmentLabel = (appt: Pick<Appointment, 'title' | 'treatmentIds' | 'treatmentType'>): string => {
    if (appt.title?.trim()) return appt.title;
    const treatments = (appt.treatmentIds || []).filter((x): x is Treatment => typeof x === 'object' && !!x);
    if (treatments.length) return treatments.map(localizedTreatmentName).join(', ');
    return appt.treatmentType || i18n.t('appointments.visit');
};

/** Cancel reason for display: a known code is translated, older free text is shown as written. */
export const cancelReasonLabel = (reason?: string) =>
    reason ? i18n.t(`appointments.cancelReasons.${reason}`, { defaultValue: reason }) : '';
