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
    /** POST/PATCH /treatments */
    editTreatments: ['clinic_admin', 'dentist'],
    /** DELETE /treatments/:id */
    deleteTreatments: ['clinic_admin'],
    /** /reports/* */
    viewReports: ['super_admin', 'clinic_admin', 'dentist'],
    /** POST/PATCH /appointments */
    manageAppointments: ['clinic_admin', 'dentist', 'receptionist'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const hasPermission = (role: UserRole | undefined, permission: Permission): boolean =>
    !!role && (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
