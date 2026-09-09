/**
 * Staff members exist as two linked documents: an auth `User` (the login, and
 * the id carried in the JWT) and a `UserProfile` (clinic-facing details).
 *
 * Every reference to a staff member across the API — `Appointment.dentistId`,
 * `TreatmentEntry.dentistId`, `Invoice.createdBy`, `DentalRecord.lastUpdatedBy`
 * — points at the auth `User`. The dentists endpoint, however, returns
 * `UserProfile` documents, whose `_id` is a *different* id. `authId` is the
 * link between them, so that is what must be sent to the API.
 *
 * Sending the profile `_id` instead stores a reference that resolves to
 * nothing, and the populated dentist comes back `null`.
 */
export const staffRefId = (staff: { _id?: string; authId?: string } | null | undefined): string =>
    staff?.authId || staff?._id || '';
