import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Currency } from 'src/common/utils';

export type TreatmentPlanDocument = TreatmentPlan & Document;

/**
 * draft → presented (estimate given) → accepted (per item) → completed (all
 * accepted items done). Declined and cancelled are final; revise sends a
 * presented or accepted plan back to draft.
 */
export enum TreatmentPlanStatus {
    DRAFT = 'draft',
    PRESENTED = 'presented',
    ACCEPTED = 'accepted',
    COMPLETED = 'completed',
    DECLINED = 'declined',
    CANCELLED = 'cancelled',
}

export enum TreatmentPlanAction {
    CREATED = 'created',
    PRESENTED = 'presented',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    REVISED = 'revised',
    CANCELLED = 'cancelled',
    COMPLETED = 'completed',
}

@Schema({ _id: false })
export class TreatmentPlanEvent {
    @Prop({ required: true, enum: TreatmentPlanAction })
    action: TreatmentPlanAction;

    @Prop({ required: true })
    at: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    by: Types.ObjectId;

    @Prop({ trim: true })
    note: string;
}

export const TreatmentPlanEventSchema = SchemaFactory.createForClass(TreatmentPlanEvent);

/**
 * A set of proposed treatments for one patient, priced and given to the
 * patient as an estimate. The items are the patient's planned treatment
 * entries (`TreatmentEntry.planId`), so they show on the chart and are done
 * and billed like any other entry. A patient may have several plans (options).
 */
@Schema({ timestamps: true })
export class TreatmentPlan {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Patient', required: true })
    patientId: Types.ObjectId;

    @Prop({ required: true, trim: true, maxlength: 120 })
    title: string;

    /** Responsible dentist; new items default to them. */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    dentistId: Types.ObjectId;

    @Prop({ required: true, enum: TreatmentPlanStatus, default: TreatmentPlanStatus.DRAFT })
    status: TreatmentPlanStatus;

    /** The clinic's currency when the plan was made (D3). */
    @Prop({ required: true, enum: Currency })
    currency: Currency;

    /** Printed on the estimate. */
    @Prop({ trim: true, maxlength: 2000 })
    notes: string;

    /** Clinic calendar day (`YYYY-MM-DD`) the estimate is valid until. Set when presented. */
    @Prop()
    validUntil: string;

    /**
     * Bumped by every change to the plan or its items, so an acceptance
     * records exactly the version the patient was shown.
     */
    @Prop({ required: true, default: 0 })
    revision: number;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;

    @Prop()
    presentedAt: Date;

    @Prop()
    acceptedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    acceptedBy: Types.ObjectId;

    @Prop()
    closedAt: Date;

    /** Why it was declined or cancelled. */
    @Prop({ trim: true })
    closeReason: string;

    @Prop({ type: [TreatmentPlanEventSchema], default: [] })
    history: TreatmentPlanEvent[];
}

export const TreatmentPlanSchema = SchemaFactory.createForClass(TreatmentPlan);

TreatmentPlanSchema.index({ clinicId: 1, patientId: 1, createdAt: -1 });
