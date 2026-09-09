import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PatientDocument = Patient & Document;

@Schema({ _id: false })
export class Address {
    @Prop({ trim: true })
    street: string;

    @Prop({ trim: true })
    city: string;

    @Prop({ trim: true })
    state: string;

    @Prop({ trim: true })
    zipCode: string;

    @Prop({ trim: true })
    country: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class EmergencyContact {
    @Prop({ trim: true })
    name: string;

    @Prop({ trim: true })
    relationship: string;

    @Prop({ trim: true })
    phone: string;
}

export const EmergencyContactSchema = SchemaFactory.createForClass(EmergencyContact);

@Schema({ _id: false })
export class MedicalHistory {
    @Prop({ type: [String], default: [] })
    conditions: string[];

    @Prop({ type: [String], default: [] })
    allergies: string[];

    @Prop({ type: [String], default: [] })
    medications: string[];

    @Prop({ trim: true })
    notes: string;
}

export const MedicalHistorySchema = SchemaFactory.createForClass(MedicalHistory);

@Schema({ _id: false })
export class Insurance {
    @Prop({ trim: true })
    provider: string;

    @Prop({ trim: true })
    policyNumber: string;

    @Prop({ trim: true })
    groupNumber: string;

    @Prop()
    expirationDate: Date;
}

export const InsuranceSchema = SchemaFactory.createForClass(Insurance);

export enum Gender {
    MALE = 'male',
    FEMALE = 'female',
    OTHER = 'other',
}

export enum PatientStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    ARCHIVED = 'archived',
    DECEASED = 'deceased',
}

/** Statuses that still count the patient as an active client of the clinic. */
export const ACTIVE_PATIENT_STATUSES: PatientStatus[] = [PatientStatus.ACTIVE];

/**
 * One entry per status transition, newest last. The first entry records the
 * registration itself and has no `from`.
 *
 * Kept on the patient rather than in its own collection: a patient accumulates
 * a handful of these over its lifetime, and they are only ever read together
 * with the patient.
 */
@Schema({ timestamps: false })
export class PatientStatusChange {
    @Prop({ enum: PatientStatus })
    from: PatientStatus;

    @Prop({ required: true, enum: PatientStatus })
    to: PatientStatus;

    @Prop({ trim: true })
    reason: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    changedBy: Types.ObjectId;

    @Prop({ required: true, default: () => new Date() })
    changedAt: Date;
}

export const PatientStatusChangeSchema = SchemaFactory.createForClass(PatientStatusChange);

@Schema({ timestamps: true })
export class Patient {
    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    firstName: string;

    @Prop({ required: true, trim: true })
    lastName: string;

    @Prop({ trim: true })
    patronymic: string;

    @Prop({ required: true })
    dateOfBirth: Date;

    @Prop({ required: true, enum: Gender })
    gender: Gender;

    @Prop({ required: true, trim: true })
    phone: string;

    @Prop({ trim: true, lowercase: true })
    email: string;

    /** Patient photo, stored as a resized `data:image/...;base64,` URL. */
    @Prop({ trim: true })
    photo: string;

    @Prop({ type: AddressSchema })
    address: Address;

    @Prop({ type: EmergencyContactSchema })
    emergencyContact: EmergencyContact;

    @Prop({ type: MedicalHistorySchema })
    medicalHistory: MedicalHistory;

    @Prop({ type: InsuranceSchema })
    insurance: Insurance;

    @Prop({ trim: true })
    notes: string;

    @Prop({
        required: true,
        enum: PatientStatus,
        default: PatientStatus.ACTIVE,
        index: true,
    })
    status: PatientStatus;

    /** Kept in sync with `status` so legacy queries on `isActive` keep working. */
    @Prop({ default: true })
    isActive: boolean;

    /** Audit trail of every status transition, including registration. */
    @Prop({ type: [PatientStatusChangeSchema], default: [] })
    statusHistory: PatientStatusChange[];

    @Prop()
    lastVisit: Date;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);

PatientSchema.index({ clinicId: 1, lastName: 1, firstName: 1 });

// One patient per email *inside a clinic* — the clinic is the tenant boundary,
// so two clinics may each have a patient with the same address.
// The partial filter keeps patients with no email (and legacy empty strings)
// out of the index, so they are never duplicates of each other.
PatientSchema.index(
    { clinicId: 1, email: 1 },
    {
        unique: true,
        name: 'clinicId_1_email_1_unique',
        partialFilterExpression: { email: { $type: 'string', $gt: '' } },
    },
);
