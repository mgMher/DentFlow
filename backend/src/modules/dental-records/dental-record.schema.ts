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

/**
 * Anatomical tooth surfaces.
 *
 * `occlusal` is the chewing surface of premolars/molars, `incisal` its
 * equivalent on incisors and canines. `buccal` (a.k.a. facial/labial) faces the
 * cheek, `lingual` the tongue, and `palatal` is the upper-jaw name for the same
 * side. `cervical` is the gum-line band around the tooth.
 */
export enum ToothSurface {
    MESIAL = 'mesial',
    DISTAL = 'distal',
    OCCLUSAL = 'occlusal',
    INCISAL = 'incisal',
    BUCCAL = 'buccal',
    LINGUAL = 'lingual',
    PALATAL = 'palatal',
    CERVICAL = 'cervical',
}

/**
 * One snapshot of a tooth taken every time its status/surfaces/notes change, so
 * the previous state is never silently overwritten.
 */
@Schema({ timestamps: false })
export class ToothStatusChange {
    @Prop({ enum: ToothStatus })
    previousStatus: ToothStatus;

    @Prop({ required: true, enum: ToothStatus })
    status: ToothStatus;

    @Prop({ type: [String], default: [] })
    surfaces: string[];

    @Prop({ type: [String], default: [] })
    conditions: string[];

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    changedBy: Types.ObjectId;

    @Prop({ required: true, default: () => new Date() })
    changedAt: Date;
}

export const ToothStatusChangeSchema = SchemaFactory.createForClass(ToothStatusChange);

@Schema({ _id: false })
export class ToothRecord {
    @Prop({ required: true })
    toothNumber: number; // Universal numbering: 1-32 adult, 51-70 pediatric (A-T mapped)

    @Prop({ enum: ToothStatus, default: ToothStatus.HEALTHY })
    status: ToothStatus;

    @Prop({ type: [String], default: [] })
    surfaces: string[]; // see ToothSurface

    @Prop({ type: [String], default: [] })
    conditions: string[];

    @Prop({ trim: true })
    notes: string;

    /** Newest last. Every change to this tooth appends an entry. */
    @Prop({ type: [ToothStatusChangeSchema], default: [] })
    history: ToothStatusChange[];

    @Prop()
    updatedAt: Date;
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
