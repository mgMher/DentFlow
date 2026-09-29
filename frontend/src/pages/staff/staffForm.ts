import { DayAvailability, StaffMember, StaffRole } from '../../types';
import { DAYS_OF_WEEK } from '../../utils/constants';
import { normalizeArmenianPhone } from '../../utils/validators';

/** Mirrors the API's `MIN_PASSWORD_LENGTH`; `validation.passwordMin` reads the same. */
export const MIN_PASSWORD_LENGTH = 8;

/** Flat shape of the staff create/edit form. */
export interface StaffFormData {
    firstName: string;
    lastName: string;
    patronymic: string;
    email: string;
    phone: string;
    role: StaffRole;
    specialization: string;
    licenseNumber: string;
}

export interface StaffCreateFormData extends StaffFormData {
    password: string;
    confirmPassword: string;
}

export const emptyStaffForm: StaffFormData = {
    firstName: '',
    lastName: '',
    patronymic: '',
    email: '',
    phone: '',
    role: 'dentist',
    specialization: '',
    licenseNumber: '',
};

export const emptyStaffCreateForm: StaffCreateFormData = {
    ...emptyStaffForm,
    password: '',
    confirmPassword: '',
};

/** Fills the form from a loaded member, never leaving a field `undefined`. */
export const staffToForm = (staff: StaffMember): StaffFormData => ({
    ...emptyStaffForm,
    firstName: staff.firstName || '',
    lastName: staff.lastName || '',
    patronymic: staff.patronymic || '',
    email: staff.email || '',
    phone: staff.phone || '',
    // `super_admin` is not assignable from this screen; show the nearest role
    // so the select has a valid value instead of rendering blank.
    role: (staff.role === 'super_admin' ? 'clinic_admin' : staff.role) || 'dentist',
    specialization: staff.specialization || '',
    licenseNumber: staff.licenseNumber || '',
});

/**
 * Shapes the flat form state into the API payload.
 *
 * Optional text fields are sent as `''` rather than omitted, so clearing one in
 * the UI actually clears it on the server — omitting the key reads as "leave
 * untouched". `specialization` only travels for dentists; the API clears it for
 * every other role anyway.
 */
export const toStaffPayload = (data: StaffFormData) => ({
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    patronymic: data.patronymic.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim() ? normalizeArmenianPhone(data.phone) : '',
    role: data.role,
    specialization: data.role === 'dentist' ? data.specialization.trim() : '',
    licenseNumber: data.licenseNumber.trim(),
});

/**
 * A new record has nothing to clear, and the API rejects an empty string where
 * it validates a format (`phone`), so optional blanks are dropped instead.
 */
export const toStaffCreatePayload = (data: StaffCreateFormData) => {
    const payload: Record<string, unknown> = {
        ...toStaffPayload(data),
        password: data.password,
    };

    for (const field of ['patronymic', 'phone', 'specialization', 'licenseNumber']) {
        if (!payload[field]) delete payload[field];
    }

    return payload;
};

/**
 * One editable row per weekday. `isOpen` exists only in the form: the API
 * stores working days and leaves days off out of the array entirely.
 */
export interface AvailabilityRow extends DayAvailability {
    day: string;
    isOpen: boolean;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '18:00';

/** Monday–Friday, which is what a new clinic member most often works. */
const isWeekday = (dayOfWeek: number) => dayOfWeek > 0 && dayOfWeek < 6;

export const availabilityToRows = (
    availability: DayAvailability[] | undefined,
): AvailabilityRow[] =>
    DAYS_OF_WEEK.map((day, dayOfWeek) => {
        const existing = availability?.find((a) => a.dayOfWeek === dayOfWeek);
        return {
            dayOfWeek,
            day,
            startTime: existing?.startTime || DEFAULT_START,
            endTime: existing?.endTime || DEFAULT_END,
            // An empty array is a real answer — "works no days" — so only fall
            // back to the weekday default when the member has no schedule yet.
            isOpen: availability ? !!existing : isWeekday(dayOfWeek),
        };
    });

export const rowsToAvailability = (rows: AvailabilityRow[]): DayAvailability[] =>
    rows
        .filter((row) => row.isOpen)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));

/** Rows whose end time is not after their start time; the API rejects those. */
export const invalidAvailabilityRows = (rows: AvailabilityRow[]): AvailabilityRow[] =>
    rows.filter((row) => row.isOpen && row.startTime >= row.endTime);

/** `clinic_admin` → `clinicAdmin`, to reach the `staff.*` translation keys. */
export const roleTranslationKey = (role: string): string =>
    ({
        clinic_admin: 'clinicAdmin',
        dentist: 'dentist',
        receptionist: 'receptionist',
        assistant: 'assistant',
        super_admin: 'superAdmin',
    }[role] || role);
