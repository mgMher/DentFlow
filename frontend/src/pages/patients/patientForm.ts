import { Patient } from '../../types';
import { normalizeArmenianPhone } from 'utils/validators';

/** Flat shape of the patient create/edit form. */
export interface PatientFormData {
    firstName: string;
    lastName: string;
    patronymic: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    phone: string;
    email: string;
    photo: string | null;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    emergencyName: string;
    emergencyRelationship: string;
    emergencyPhone: string;
    conditions: string[];
    allergies: string[];
    medications: string[];
    medicalNotes: string;
    insuranceProvider: string;
    policyNumber: string;
    groupNumber: string;
    expirationDate: string;
}

export const emptyPatientForm: PatientFormData = {
    firstName: '',
    lastName: '',
    patronymic: '',
    dateOfBirth: '',
    gender: 'male',
    phone: '',
    email: '',
    photo: null,
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    conditions: [],
    allergies: [],
    medications: [],
    medicalNotes: '',
    insuranceProvider: '',
    policyNumber: '',
    groupNumber: '',
    expirationDate: '',
};

/** Fills the form from a loaded patient, never leaving a field `undefined`. */
export const patientToForm = (patient: Patient): PatientFormData => ({
    ...emptyPatientForm,
    firstName: patient.firstName || '',
    lastName: patient.lastName || '',
    patronymic: patient.patronymic || '',
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.substring(0, 10) : '',
    gender: patient.gender || 'male',
    phone: patient.phone || '',
    email: patient.email || '',
    photo: patient.photo || null,
    street: patient.address?.street || '',
    city: patient.address?.city || '',
    state: patient.address?.state || '',
    zipCode: patient.address?.zipCode || '',
    country: patient.address?.country || '',
    emergencyName: patient.emergencyContact?.name || '',
    emergencyRelationship: patient.emergencyContact?.relationship || '',
    emergencyPhone: patient.emergencyContact?.phone || '',
    conditions: patient.medicalHistory?.conditions || [],
    allergies: patient.medicalHistory?.allergies || [],
    medications: patient.medicalHistory?.medications || [],
    medicalNotes: patient.medicalHistory?.notes || '',
    insuranceProvider: patient.insurance?.provider || '',
    policyNumber: patient.insurance?.policyNumber || '',
    groupNumber: patient.insurance?.groupNumber || '',
    expirationDate: patient.insurance?.expirationDate
        ? patient.insurance.expirationDate.substring(0, 10)
        : '',
});

/**
 * Shapes the flat form state into the API payload. `null` means "clear this
 * field" server-side, `undefined` means "leave it untouched", so optional
 * blocks are only sent when they hold something.
 */
export const toPatientPayload = (data: PatientFormData) => ({
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    patronymic: data.patronymic?.trim() || undefined,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    phone: normalizeArmenianPhone(data.phone),
    email: data.email?.trim() ? data.email.trim().toLowerCase() : null,
    photo: data.photo || null,
    address: {
        street: data.street?.trim() || undefined,
        city: data.city?.trim() || undefined,
        state: data.state?.trim() || undefined,
        zipCode: data.zipCode?.trim() || undefined,
        country: data.country?.trim() || undefined,
    },
    emergencyContact: data.emergencyName?.trim()
        ? {
              name: data.emergencyName.trim(),
              relationship: data.emergencyRelationship?.trim() || undefined,
              phone: data.emergencyPhone?.trim()
                  ? normalizeArmenianPhone(data.emergencyPhone)
                  : undefined,
          }
        : undefined,
    medicalHistory: {
        conditions: data.conditions || [],
        allergies: data.allergies || [],
        medications: data.medications || [],
        notes: data.medicalNotes?.trim() || undefined,
    },
    insurance: data.insuranceProvider?.trim()
        ? {
              provider: data.insuranceProvider.trim(),
              policyNumber: data.policyNumber?.trim() || undefined,
              groupNumber: data.groupNumber?.trim() || undefined,
              expirationDate: data.expirationDate || undefined,
          }
        : undefined,
});
