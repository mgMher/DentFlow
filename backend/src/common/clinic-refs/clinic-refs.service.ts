import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { errorBody } from 'src/common/utils';
import { User, UserDocument } from 'src/modules/auth/auth.schema';
import { Patient, PatientDocument, PatientStatus } from 'src/modules/patients/patient.schema';
import { TreatmentRoom, TreatmentRoomDocument } from 'src/modules/schedule/treatment-room.schema';
import { Treatment, TreatmentDocument } from 'src/modules/treatments/treatment.schema';
import { Appointment, AppointmentDocument } from 'src/modules/appointments/appointment.schema';
import { Clinic, ClinicDocument } from 'src/modules/clinics/clinic.schema';
import { Currency, DEFAULT_CLINIC_TIMEZONE } from 'src/common/utils';

type Id = string | Types.ObjectId;

const toObjectId = (id: Id) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

/** Patients you can no longer book or bill. Inactive patients may come back, so they stay allowed. */
const CLOSED_PATIENT_STATUSES = [PatientStatus.ARCHIVED, PatientStatus.DECEASED];

/**
 * Verifies that ids taken from a request body belong to the caller's clinic.
 *
 * Every tenant query filters on `clinicId`, but a body field such as
 * `patientId` is just an ObjectId: nothing stopped a caller from storing
 * another clinic's id, after which `.populate()` happily returned that
 * clinic's patient name, phone and email. Call these before every write that
 * stores a reference.
 */
@Injectable()
export class ClinicRefsService {
    constructor(
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(TreatmentRoom.name) private readonly roomModel: Model<TreatmentRoomDocument>,
        @InjectModel(Treatment.name) private readonly treatmentModel: Model<TreatmentDocument>,
        @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    ) {}

    /** The clinic's IANA timezone, for "today" / "this month" / date filters. */
    async timezoneOf(clinicId: Id): Promise<string> {
        return (await this.localeOf(clinicId)).timezone;
    }

    /** Timezone and the one currency the clinic bills in (D3). */
    async localeOf(clinicId: Id): Promise<{ timezone: string; currency: Currency }> {
        const clinic = await this.clinicModel.findById(toObjectId(clinicId)).select('timezone currency').lean();
        return {
            timezone: clinic?.timezone || DEFAULT_CLINIC_TIMEZONE,
            currency: (clinic?.currency as Currency) || Currency.AMD,
        };
    }

    /** The patient exists in this clinic. With `forBooking`, it must also not be archived or deceased. */
    async assertPatient(clinicId: Id, patientId: Id, opts: { forBooking?: boolean } = {}): Promise<void> {
        const patient = await this.patientModel
            .findOne({ _id: toObjectId(patientId), clinicId: toObjectId(clinicId) })
            .select('status')
            .lean();

        if (!patient) {
            throw new NotFoundException(errorBody('patientNotFound', 'Patient not found'));
        }
        if (opts.forBooking && CLOSED_PATIENT_STATUSES.includes(patient.status)) {
            throw new BadRequestException(
                errorBody('patientClosed', `Patient is ${patient.status} and cannot be booked or billed`),
            );
        }
    }

    /** An active staff account with the dentist role, in this clinic. `dentistId` is the auth User id. */
    async assertDentist(clinicId: Id, dentistId: Id): Promise<void> {
        const exists = await this.userModel.exists({
            _id: toObjectId(dentistId),
            clinicId: toObjectId(clinicId),
            role: Role.DENTIST,
            isActive: true,
        });
        if (!exists) {
            throw new NotFoundException(errorBody('dentistNotFound', 'Dentist not found or inactive'));
        }
    }

    async assertRoom(clinicId: Id, roomId: Id): Promise<void> {
        await this.assertExists(this.roomModel, clinicId, roomId, { isActive: true }, 'roomNotFound', 'Room');
    }

    async assertTreatment(clinicId: Id, treatmentId: Id): Promise<void> {
        await this.assertExists(this.treatmentModel, clinicId, treatmentId, {}, 'treatmentNotFound', 'Treatment');
    }

    /** A catalogue treatment of this clinic, for its defaults (resulting tooth status, price). */
    async getTreatment(clinicId: Id, treatmentId: Id) {
        const treatment = await this.treatmentModel
            .findOne({ _id: toObjectId(treatmentId), clinicId: toObjectId(clinicId) })
            .select('name toothStatus price isActive')
            .lean();
        if (!treatment) {
            throw new NotFoundException(errorBody('treatmentNotFound', 'Treatment not found'));
        }
        return treatment;
    }

    /** All ids exist in this clinic. Duplicates are allowed (an item can repeat on an invoice). */
    async assertTreatments(clinicId: Id, treatmentIds: Id[]): Promise<void> {
        const unique = [...new Set(treatmentIds.map((id) => id.toString()))];
        if (!unique.length) return;

        const found = await this.treatmentModel.countDocuments({
            _id: { $in: unique.map(toObjectId) },
            clinicId: toObjectId(clinicId),
        });
        if (found !== unique.length) {
            throw new NotFoundException(errorBody('treatmentNotFound', 'Treatment not found'));
        }
    }

    /** The appointment exists in this clinic and, when given, belongs to that patient. */
    async assertAppointment(clinicId: Id, appointmentId: Id, patientId?: Id): Promise<void> {
        const filter: FilterQuery<AppointmentDocument> = patientId ? { patientId: toObjectId(patientId) } : {};
        await this.assertExists(this.appointmentModel, clinicId, appointmentId, filter, 'appointmentNotFound', 'Appointment');
    }

    private async assertExists<T>(
        model: Model<T>,
        clinicId: Id,
        id: Id,
        extra: FilterQuery<T>,
        code: string,
        label: string,
    ): Promise<void> {
        const exists = await model.exists({ ...extra, _id: toObjectId(id), clinicId: toObjectId(clinicId) } as FilterQuery<T>);
        if (!exists) {
            throw new NotFoundException(errorBody(code, `${label} not found`));
        }
    }
}
