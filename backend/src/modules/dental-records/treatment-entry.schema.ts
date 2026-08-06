import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

@Schema({ timestamps: true })
export class TreatmentEntry {
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

    @Prop({ required: true })
    toothNumber: number;

    @Prop({ type: Types.ObjectId, ref: 'Treatment' })
    treatmentId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    treatmentName: string;

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
    })
    dentistId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Appointment' })
    appointmentId: Types.ObjectId;

    @Prop({ required: true, default: () => new Date() })
    date: Date;

    @Prop({ type: [String], default: [] })
    surfaces: string[];

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: [TreatmentImageSchema], default: [] })
    images: TreatmentImage[];

    @Prop({ type: Number })
    cost: number;

    @Prop({ enum: Currency })
    currency: Currency;
}

export const TreatmentEntrySchema = SchemaFactory.createForClass(TreatmentEntry);

TreatmentEntrySchema.index({ clinicId: 1, patientId: 1, date: -1 });
TreatmentEntrySchema.index({ clinicId: 1, patientId: 1, toothNumber: 1 });
