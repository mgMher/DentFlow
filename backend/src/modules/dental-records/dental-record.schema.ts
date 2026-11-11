import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

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

/** What is on one surface. A tooth can be decayed mesially and filled occlusally. */
export enum SurfaceStatus {
    DECAYED = 'decayed',
    FILLED = 'filled',
    SEALANT = 'sealant',
}

@Schema({ _id: false })
export class SurfaceState {
    @Prop({ required: true, enum: ToothSurface })
    surface: ToothSurface;

    @Prop({ required: true, enum: SurfaceStatus })
    status: SurfaceStatus;
}

export const SurfaceStateSchema = SchemaFactory.createForClass(SurfaceState);

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

    @Prop({ type: [SurfaceStateSchema], default: [] })
    surfaces: SurfaceState[];

    @Prop({ type: [String], default: [] })
    conditions: string[];

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    changedBy: Types.ObjectId;

    @Prop({ required: true, default: () => new Date() })
    changedAt: Date;

    /** Set when the change came from completing a treatment entry. */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TreatmentEntry' })
    treatmentEntryId: Types.ObjectId;
}

export const ToothStatusChangeSchema = SchemaFactory.createForClass(ToothStatusChange);

@Schema({ _id: false })
export class ToothRecord {
    @Prop({ required: true })
    toothNumber: number; // FDI, see tooth-numbering.ts

    /** The whole tooth. Surface findings (caries, fillings) live in `surfaces`. */
    @Prop({ enum: ToothStatus, default: ToothStatus.HEALTHY })
    status: ToothStatus;

    /** At most one entry per surface. */
    @Prop({ type: [SurfaceStateSchema], default: [] })
    surfaces: SurfaceState[];

    @Prop({ type: [String], default: [] })
    conditions: string[];

    @Prop({ trim: true })
    notes: string;

    /** Newest last. Every change to this tooth appends an entry. */
    @Prop({ type: [ToothStatusChangeSchema], default: [] })
    history: ToothStatusChange[];

    @Prop()
    updatedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    updatedBy: Types.ObjectId;
}

export const ToothRecordSchema = SchemaFactory.createForClass(ToothRecord);

/** The teeth of a chart type the patient was switched away from, kept so a switch never loses data. */
@Schema({ _id: false })
export class ArchivedChart {
    @Prop({ required: true, enum: ['adult', 'pediatric'] })
    chartType: string;

    @Prop({ type: [ToothRecordSchema], default: [] })
    teeth: ToothRecord[];

    @Prop({ required: true })
    archivedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    archivedBy: Types.ObjectId;
}

export const ArchivedChartSchema = SchemaFactory.createForClass(ArchivedChart);

// Optimistic concurrency: two people saving the same chart used to end in a
// 500 (VersionError) or, worse, one silently overwriting the other.
@Schema({ timestamps: true, optimisticConcurrency: true })
export class DentalRecord {
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

    @Prop({ type: [ToothRecordSchema], default: [] })
    teeth: ToothRecord[];

    @Prop({ enum: ['adult', 'pediatric'], default: 'adult' })
    chartType: string;

    /** Charts without it still use Universal numbers and are converted at startup. */
    @Prop({ enum: ['fdi'], default: 'fdi' })
    numbering: string;

    @Prop({ type: [ArchivedChartSchema], default: [] })
    archivedCharts: ArchivedChart[];

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    lastUpdatedBy: Types.ObjectId;
}

export const DentalRecordSchema = SchemaFactory.createForClass(DentalRecord);

DentalRecordSchema.index({ clinicId: 1, patientId: 1 }, { unique: true });
