import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

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

/** How a guardian is related to the patient (F8). */
export enum GuardianRelationship {
    MOTHER = 'mother',
    FATHER = 'father',
    GRANDPARENT = 'grandparent',
    SIBLING = 'sibling',
    GUARDIAN = 'guardian',
    OTHER = 'other',
}

/**
 * A parent or guardian (F8): either another patient of the clinic
 * (`patientId`) or a contact who is not a patient (`name` + `phone`).
 * One of a patient's guardians is the main one: under 18, reminders go to them.
 */
@Schema()
export class Guardian {
    _id: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Patient' })
    patientId?: Types.ObjectId;

    @Prop({ trim: true })
    name?: string;

    @Prop({ trim: true })
    phone?: string;

    @Prop({ required: true, enum: GuardianRelationship })
    relationship: GuardianRelationship;

    @Prop({ default: false })
    isPrimary: boolean;
}

export const GuardianSchema = SchemaFactory.createForClass(Guardian);

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

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    changedBy: Types.ObjectId;

    @Prop({ required: true, default: () => new Date() })
    changedAt: Date;
}

export const PatientStatusChangeSchema = SchemaFactory.createForClass(PatientStatusChange);

@Schema({ timestamps: true })
export class Patient {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
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

    /** Parents and guardians (F8); children are the patients that list this one here. */
    @Prop({ type: [GuardianSchema], default: [] })
    guardians: Guardian[];

    /** Appointment reminders (F3): no reminders at all when true. */
    @Prop({ default: false })
    remindersOptOut: boolean;

    /** Telegram chat that gets this patient's reminders (set when they open the link). */
    @Prop()
    telegramChatId: string;

    @Prop()
    telegramLinkedAt: Date;

    /** One-time code in the patient's Telegram link; never sent to the client. */
    @Prop({ select: false })
    telegramLinkCode: string;

    @Prop({ select: false })
    telegramLinkCodeAt: Date;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);

PatientSchema.index({ clinicId: 1, lastName: 1, firstName: 1 });
PatientSchema.index({ telegramLinkCode: 1 }, { sparse: true });
// A guardian's children (F8).
PatientSchema.index({ clinicId: 1, 'guardians.patientId': 1 });
PatientSchema.index({ clinicId: 1, telegramChatId: 1 }, { sparse: true });

// Email is deliberately not unique (D4): a parent registers several children
// under one address. The create form warns about matches instead.
