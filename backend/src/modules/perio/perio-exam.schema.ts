import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type PerioExamDocument = PerioExam & Document;

/**
 * The six probing sites of a tooth, always stored in this order: three on
 * the cheek/lip side (distal, middle, mesial), three on the tongue/palate side.
 * The screen arranges them by quadrant; the data does not.
 */
export const PERIO_SITES = ['db', 'b', 'mb', 'dl', 'l', 'ml'] as const;
export type PerioSiteName = (typeof PERIO_SITES)[number];

export const PD_MAX = 15;
export const REC_MIN = -5;
export const REC_MAX = 15;

@Schema({ _id: false })
export class PerioSite {
    /** Probing depth, mm; `null` not measured. */
    @Prop({ type: Number, default: null, min: 0, max: PD_MAX })
    pd: number | null;

    /**
     * Recession, mm: how far the gum margin is below the enamel–cement
     * junction; negative when it is above (swollen gum). Attachment loss = PD + recession.
     */
    @Prop({ type: Number, default: null, min: REC_MIN, max: REC_MAX })
    rec: number | null;

    @Prop({ default: false }) bop: boolean;
    @Prop({ default: false }) sup: boolean;
    @Prop({ default: false }) plaque: boolean;
}

export const PerioSiteSchema = SchemaFactory.createForClass(PerioSite);

@Schema({ _id: false })
export class PerioTooth {
    @Prop({ required: true })
    toothNumber: number;

    @Prop({ default: false }) missing: boolean;
    @Prop({ default: false }) implant: boolean;

    /** Miller 0–3; `null` not checked. */
    @Prop({ type: Number, default: null, min: 0, max: 3 })
    mobility: number | null;

    /** Furcation involvement, the worst grade found (1–3); molars and upper first premolars. */
    @Prop({ type: Number, default: null, min: 0, max: 3 })
    furcation: number | null;

    /** Six sites in `PERIO_SITES` order. */
    @Prop({ type: [PerioSiteSchema], default: [] })
    sites: PerioSite[];
}

export const PerioToothSchema = SchemaFactory.createForClass(PerioTooth);

/**
 * F12: a periodontal exam — six-site probing of every tooth on one date.
 * Exams are kept side by side to compare; removal hides one, with the reason.
 */
@Schema({ timestamps: true, collection: 'perio_exams' })
export class PerioExam {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Patient', required: true })
    patientId: Types.ObjectId;

    /** The clinic's calendar day, YYYY-MM-DD. */
    @Prop({ required: true })
    date: string;

    /** Whose exam it is (may differ from who typed it in, e.g. an assistant). */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    dentistId: Types.ObjectId | null;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    recordedBy: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    lastUpdatedBy: Types.ObjectId;

    @Prop({ type: [PerioToothSchema], default: [] })
    teeth: PerioTooth[];

    @Prop({ trim: true, maxlength: 2000 })
    notes: string;

    @Prop()
    deletedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    deletedBy: Types.ObjectId;

    @Prop({ trim: true })
    deleteReason: string;
}

export const PerioExamSchema = SchemaFactory.createForClass(PerioExam);

PerioExamSchema.index({ clinicId: 1, patientId: 1, date: -1 });
