import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AppointmentStatus {
    SCHEDULED = 'scheduled',
    CONFIRMED = 'confirmed',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    NO_SHOW = 'no_show',
}

export enum RecurringFrequency {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}

@Schema({ _id: false })
export class RecurringPattern {
    @Prop({ required: true, enum: RecurringFrequency })
    frequency: RecurringFrequency;

    @Prop({ required: true, min: 1, default: 1 })
    interval: number;

    @Prop({ required: true })
    endDate: Date;

    @Prop({ type: [Number] })
    daysOfWeek: number[];
}

export const RecurringPatternSchema = SchemaFactory.createForClass(RecurringPattern);

export type AppointmentDocument = Appointment & Document;

@Schema({ timestamps: true })
export class Appointment {
    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    })
    patientId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    dentistId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'TreatmentRoom',
    })
    treatmentRoomId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ required: true, index: true })
    startTime: Date;

    @Prop({ required: true })
    endTime: Date;

    @Prop({ type: Number })
    duration: number;

    @Prop({
        required: true,
        enum: AppointmentStatus,
        default: AppointmentStatus.SCHEDULED,
    })
    status: AppointmentStatus;

    @Prop({ trim: true })
    treatmentType: string;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Treatment' }] })
    treatmentIds: Types.ObjectId[];

    @Prop({ trim: true })
    notes: string;

    @Prop({ trim: true })
    cancelReason: string;

    @Prop({ default: false })
    isRecurring: boolean;

    @Prop({ type: RecurringPatternSchema })
    recurringPattern: RecurringPattern;

    @Prop({ trim: true })
    color: string;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.index({ clinicId: 1, dentistId: 1, startTime: 1 });
