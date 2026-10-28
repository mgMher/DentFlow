import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus } from 'src/modules/appointments/appointment.schema';

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
    constructor(@InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>) {}

    count(clinicId: Id, who: UpcomingFor): Promise<number> {
        return this.appointmentModel.countDocuments(this.filter(clinicId, who));
    }

    /** Cancel them with a reason; returns how many were cancelled. */
    async cancel(clinicId: Id, who: UpcomingFor, reason: string): Promise<number> {
        const result = await this.appointmentModel.updateMany(this.filter(clinicId, who), {
            $set: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
        });
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
