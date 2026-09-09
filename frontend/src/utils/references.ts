import { Patient, Treatment, TreatmentRoom, UserProfile } from '../types';
import { getFullName } from './formatters';

/**
 * The API returns Mongo references either populated (an object) or as a bare
 * id string, depending on the endpoint. These resolvers accept both and always
 * return something safe to render — passing the object straight into JSX is
 * what caused "Objects are not valid as a React child".
 *
 * An unpopulated reference renders as "-": showing a raw ObjectId tells the
 * user nothing.
 */
const PLACEHOLDER = '-';

export const patientName = (patient?: string | Patient | null): string => {
    if (!patient || typeof patient === 'string') return PLACEHOLDER;
    return getFullName(patient.firstName, patient.lastName, patient.patronymic) || PLACEHOLDER;
};

export const patientPhone = (patient?: string | Patient | null): string => {
    if (!patient || typeof patient === 'string') return PLACEHOLDER;
    return patient.phone || PLACEHOLDER;
};

export const patientEmail = (patient?: string | Patient | null): string => {
    if (!patient || typeof patient === 'string') return PLACEHOLDER;
    return patient.email || PLACEHOLDER;
};

/** Works for any staff reference: dentist, createdBy, receivedBy, changedBy. */
export const staffName = (
    staff?: string | UserProfile | { firstName?: string; lastName?: string } | null,
): string => {
    if (!staff || typeof staff === 'string') return PLACEHOLDER;
    return getFullName(staff.firstName || '', staff.lastName || '') || PLACEHOLDER;
};

export const roomName = (room?: string | TreatmentRoom | null): string => {
    if (!room || typeof room === 'string') return PLACEHOLDER;
    return room.name || PLACEHOLDER;
};

export const treatmentName = (treatment?: string | Treatment | null): string => {
    if (!treatment || typeof treatment === 'string') return PLACEHOLDER;
    return treatment.name || treatment.nameHy || treatment.nameRu || PLACEHOLDER;
};

/** Stable React key for a possibly-populated reference. */
export const referenceKey = (ref: string | { _id?: string }, index: number): string =>
    typeof ref === 'string' ? ref : ref?._id || String(index);
