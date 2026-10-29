import { UserRole } from '../types';

/**
 * What each role may do in the UI. Mirrors the backend `@Roles` rules: the
 * server is the authority, this only stops the UI from offering an action the
 * server will refuse (which used to end in an English "Insufficient
 * permissions" toast).
 *
 * Keep each entry next to the endpoint it guards when you change a backend rule.
 */
export const PERMISSIONS = {
    /** POST/PATCH /users, /users/:id/status — users.controller STAFF_MANAGERS */
    manageStaff: ['super_admin', 'clinic_admin'],
    /** PATCH /clinics/current*, /settings/templates — clinic_admin only */
    manageClinic: ['clinic_admin'],
    /** POST/PATCH/DELETE /schedule/rooms */
    manageRooms: ['clinic_admin'],
    /** POST/PATCH/DELETE /treatments, /treatments/:id/reactivate — treatments.controller CATALOG_EDITORS */
    editTreatments: ['clinic_admin'],
    /** Chart, tooth and treatment-entry writes — dental-records.controller CHART_EDITORS */
    editDentalChart: ['super_admin', 'clinic_admin', 'dentist'],
    /** /reports/* */
    viewReports: ['super_admin', 'clinic_admin', 'dentist'],
    /** POST /patients, PATCH /patients/:id — patients.controller PATIENT_EDITORS */
    editPatients: ['super_admin', 'clinic_admin', 'dentist', 'receptionist'],
    /** Medical history and PATCH /patients/:id/status — patients.controller CLINICAL_EDITORS */
    editClinicalRecords: ['super_admin', 'clinic_admin', 'dentist'],
    /** GET /billing/* — billing.controller BILLING_VIEWERS (assistants: none) */
    viewBilling: ['super_admin', 'clinic_admin', 'receptionist', 'dentist'],
    /** Create / edit / issue invoices, take payments, cancel drafts — BILLING_EDITORS */
    manageBilling: ['super_admin', 'clinic_admin', 'receptionist'],
    /** Refunds, cancelling issued invoices, revenue — BILLING_ADMINS */
    billingAdmin: ['super_admin', 'clinic_admin'],
    /** POST/PATCH /appointments */
    manageAppointments: ['clinic_admin', 'dentist', 'receptionist'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const hasPermission = (role: UserRole | undefined, permission: Permission): boolean =>
    !!role && (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
