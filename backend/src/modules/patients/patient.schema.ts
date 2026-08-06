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

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    lastVisit: Date;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);

PatientSchema.index({ clinicId: 1, lastName: 1, firstName: 1 });
