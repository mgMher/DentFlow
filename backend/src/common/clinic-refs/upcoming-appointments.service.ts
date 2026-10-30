import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus, CancelReason } from 'src/modules/appointments/appointment.schema';
import { Role } from 'src/common/decorators';
import { NotificationsService, personName } from 'src/modules/notifications/notifications.service';
import { NotificationRelatedType, NotificationType } from 'src/modules/notifications/notification.schema';

type Id = string | Types.ObjectId;
const oid = (id: Id) => new Types.ObjectId(id.toString());

/** Appointments that still need to happen: booked and in the future. */
const OPEN_STATUSES = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];

export interface UpcomingFor {
    patientId?: Id;
    dentistId?: Id;
}

/**
 * What happens to booked appointments when their patient or dentist leaves.
 * Archiving a patient or deactivating a dentist used to leave every future
 * appointment in the calendar as if nothing happened.
 */
@Injectable()
export class UpcomingAppointmentsService {
    constructor(
        @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
        private readonly notifications: NotificationsService,
    ) {}

    count(clinicId: Id, who: UpcomingFor): Promise<number> {
        return this.appointmentModel.countDocuments(this.filter(clinicId, who));
    }

    /**
     * Cancel them with a reason; returns how many were cancelled. The people
     * who have to act are told: each dentist whose patient left, or the
     * front desk (admins, receptionists) when a dentist left — they call the
     * patients.
     */
    async cancel(clinicId: Id, who: UpcomingFor, note: string, actorId?: Id): Promise<number> {
        const affected = await this.appointmentModel
            .find(this.filter(clinicId, who))
            .select('_id dentistId patientId startTime')
            .populate('patientId', 'firstName lastName')
            .populate('dentistId', 'firstName lastName')
            .lean();
        if (!affected.length) return 0;

        const result = await this.appointmentModel.updateMany(
            { ...this.filter(clinicId, who), _id: { $in: affected.map((a) => a._id) } },
            {
                $set: {
                    status: AppointmentStatus.CANCELLED,
                    cancelReason: who.patientId ? CancelReason.PATIENT_LEFT : CancelReason.DENTIST_LEFT,
                    cancelNote: note,
                    cancelledAt: new Date(),
                    ...(actorId ? { cancelledBy: oid(actorId) } : {}),
                },
            },
        );

        if (result.modifiedCount) {
            if (who.patientId) {
                const byDentist = new Map<string, typeof affected>();
                for (const a of affected) {
                    const dentist = String((a.dentistId as any)?._id ?? a.dentistId);
                    byDentist.set(dentist, [...(byDentist.get(dentist) ?? []), a]);
                }
                for (const [dentistId, list] of byDentist) {
                    await this.notifications.notify({
                        clinicId,
                        recipients: [dentistId],
                        actorId,
                        type: NotificationType.APPOINTMENT_CANCELLED,
                        relatedId: who.patientId,
                        relatedType: NotificationRelatedType.PATIENT,
                        data: {
                            patientName: personName(list[0].patientId),
                            startTime: list[0].startTime,
                            count: list.length,
                            reason: CancelReason.PATIENT_LEFT,
                        },
                    });
                }
            } else {
                await this.notifications.notify({
                    clinicId,
                    recipients: await this.notifications.staffWithRoles(clinicId, [Role.CLINIC_ADMIN, Role.RECEPTIONIST]),
                    actorId,
                    type: NotificationType.DENTIST_APPOINTMENTS_CANCELLED,
                    data: { dentistName: personName(affected[0].dentistId), count: result.modifiedCount },
                });
            }
        }
        return result.modifiedCount;
    }

    private filter(clinicId: Id, who: UpcomingFor): FilterQuery<AppointmentDocument> {
        return {
            clinicId: oid(clinicId),
            status: { $in: OPEN_STATUSES },
            startTime: { $gte: new Date() },
            ...(who.patientId ? { patientId: oid(who.patientId) } : {}),
            ...(who.dentistId ? { dentistId: oid(who.dentistId) } : {}),
        };
    }
}
