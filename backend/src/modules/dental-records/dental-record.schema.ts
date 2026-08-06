import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DentalRecordDocument = DentalRecord & Document;

export enum ToothStatus {
    HEALTHY = 'healthy',
    FILLED = 'filled',
    CROWN = 'crown',
    MISSING = 'missing',
    IMPLANT = 'implant',
    NEEDS_TREATMENT = 'needs_treatment',
    ROOT_CANAL = 'root_canal',
    DECAYED = 'decayed',
    BRIDGE = 'bridge',
    VENEER = 'veneer',
}

@Schema({ _id: false })
export class ToothRecord {
    @Prop({ required: true })
    toothNumber: number; // Universal numbering: 1-32 adult, 51-70 pediatric (A-T mapped)

    @Prop({ enum: ToothStatus, default: ToothStatus.HEALTHY })
    status: ToothStatus;

    @Prop({ type: [String], default: [] })
    surfaces: string[]; // mesial, distal, occlusal, buccal, lingual

    @Prop({ type: [String], default: [] })
    conditions: string[];

    @Prop({ trim: true })
    notes: string;
}

export const ToothRecordSchema = SchemaFactory.createForClass(ToothRecord);

@Schema({ timestamps: true })
export class DentalRecord {
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

    @Prop({ type: [ToothRecordSchema], default: [] })
    teeth: ToothRecord[];

    @Prop({ enum: ['adult', 'pediatric'], default: 'adult' })
    chartType: string;

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    lastUpdatedBy: Types.ObjectId;
}

export const DentalRecordSchema = SchemaFactory.createForClass(DentalRecord);

DentalRecordSchema.index({ clinicId: 1, patientId: 1 }, { unique: true });
