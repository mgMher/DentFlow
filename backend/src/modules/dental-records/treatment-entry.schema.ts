import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { ToothStatus, ToothSurface } from './dental-record.schema';

export type TreatmentEntryDocument = TreatmentEntry & Document;

export enum Currency {
    AMD = 'AMD',
    USD = 'USD',
    RUB = 'RUB',
}

@Schema({ _id: false })
export class TreatmentImage {
    @Prop({ required: true, trim: true })
    url: string;

    @Prop({ trim: true })
    description: string;

    @Prop({ default: () => new Date() })
    uploadedAt: Date;
}

export const TreatmentImageSchema = SchemaFactory.createForClass(TreatmentImage);

/** `planned` is a treatment plan item; `done` was performed. Voiding is separate (`voidedAt`). */
export enum TreatmentEntryStatus {
    PLANNED = 'planned',
    DONE = 'done',
}

@Schema({ timestamps: true })
export class TreatmentEntry {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true,
    })
    patientId: Types.ObjectId;

    /**
     * FDI numbers. Empty for whole-mouth work (exam, X-ray, cleaning), several
     * for a bridge or a quadrant.
     */
    @Prop({ type: [Number], default: [] })
    teeth: number[];

    @Prop({ required: true, enum: TreatmentEntryStatus, default: TreatmentEntryStatus.DONE })
    status: TreatmentEntryStatus;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Treatment' })
    treatmentId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    treatmentName: string;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'User',
        required: true,
    })
    dentistId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Appointment' })
    appointmentId: Types.ObjectId;

    /** When it was done, or for a planned entry when it was planned. */
    @Prop({ required: true, default: () => new Date() })
    date: Date;

    @Prop({ type: [String], enum: ToothSurface, default: [] })
    surfaces: ToothSurface[];

    /** What the teeth become once this is done (e.g. `filled`, `missing`). Applied to the chart. */
    @Prop({ enum: ToothStatus })
    resultStatus: ToothStatus;

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: [TreatmentImageSchema], default: [] })
    images: TreatmentImage[];

    @Prop({ type: Number })
    cost: number;

    @Prop({ enum: Currency })
    currency: Currency;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;

    @Prop()
    completedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    completedBy: Types.ObjectId;

    /** Entries are never deleted: a mistake is voided, with who, when and why. */
    @Prop()
    voidedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    voidedBy: Types.ObjectId;

    @Prop({ trim: true })
    voidReason: string;
}

export const TreatmentEntrySchema = SchemaFactory.createForClass(TreatmentEntry);

TreatmentEntrySchema.index({ clinicId: 1, patientId: 1, date: -1 });
TreatmentEntrySchema.index({ clinicId: 1, patientId: 1, teeth: 1 });
