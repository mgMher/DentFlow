import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CommissionStatementDocument = HydratedDocument<CommissionStatement>;

/** One dentist's line of an approved month. Money in minor units. */
@Schema({ _id: false })
export class CommissionRow {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    dentistId: Types.ObjectId;

    /** The name at approval time. */
    @Prop()
    name: string;

    /** Money collected in the month for this dentist's work, as approved. */
    @Prop({ required: true })
    collected: number;

    /** % applied (frozen with the month). */
    @Prop({ required: true })
    rate: number;

    @Prop({ required: true })
    commission: number;

    /** Changes to earlier approved months (refunds, voids) settled in this one. */
    @Prop({ default: 0 })
    adjustment: number;

    /** Later corrections to this month already settled in a later month's adjustment. */
    @Prop({ default: 0 })
    carried: number;
}
const CommissionRowSchema = SchemaFactory.createForClass(CommissionRow);

/** What an approval took from an earlier month, so reopening can give it back. */
@Schema({ _id: false })
export class CarriedFrom {
    @Prop({ required: true })
    month: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
    dentistId: Types.ObjectId;

    @Prop({ required: true })
    delta: number;
}
const CarriedFromSchema = SchemaFactory.createForClass(CarriedFrom);

/**
 * F11: a month's dentist commission, approved (frozen) by an admin. Before
 * approval a month is only computed live; after it, refunds or voids that
 * change the month show up as an adjustment in the next approved month.
 */
@Schema({ collection: 'commission_statements', timestamps: true })
export class CommissionStatement {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    /** `YYYY-MM`, clinic calendar. */
    @Prop({ required: true })
    month: string;

    @Prop({ required: true })
    currency: string;

    @Prop({ type: [CommissionRowSchema], default: [] })
    rows: CommissionRow[];

    @Prop({ type: [CarriedFromSchema], default: [] })
    carriedFrom: CarriedFrom[];

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    approvedBy: Types.ObjectId;

    @Prop({ required: true })
    approvedAt: Date;
}

export const CommissionStatementSchema = SchemaFactory.createForClass(CommissionStatement);
CommissionStatementSchema.index({ clinicId: 1, month: 1 }, { unique: true });
