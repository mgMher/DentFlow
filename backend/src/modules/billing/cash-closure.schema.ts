import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Currency } from 'src/common/utils';

export type CashClosureDocument = CashClosure & Document;

/**
 * A closed clinic day (F5 "Z-report"): the cash counted in the drawer and a
 * snapshot of the day's figures at that moment, in minor units. One per
 * clinic and day; an admin can reopen (delete) it to close again.
 */
@Schema({ timestamps: true, collection: 'cash_closures' })
export class CashClosure {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    /** Clinic calendar day, `YYYY-MM-DD`. */
    @Prop({ required: true })
    date: string;

    @Prop({ required: true, enum: Currency })
    currency: Currency;

    /** Cash that should be in the drawer: cash received minus cash refunded. */
    @Prop({ required: true })
    expectedCash: number;

    @Prop({ required: true, min: 0 })
    countedCash: number;

    /** counted − expected: negative is a shortage. */
    @Prop({ required: true })
    difference: number;

    @Prop({ required: true })
    received: number;

    @Prop({ required: true })
    refunded: number;

    @Prop({ required: true })
    paymentCount: number;

    @Prop({ trim: true, maxlength: 1000 })
    note: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    closedBy: Types.ObjectId;
}

export const CashClosureSchema = SchemaFactory.createForClass(CashClosure);

CashClosureSchema.index({ clinicId: 1, date: 1 }, { unique: true });
