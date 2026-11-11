import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Currency } from 'src/common/utils';

export type PaymentDocument = Payment & Document;

export enum PaymentMethod {
    CASH = 'cash',
    CARD = 'card',
    BANK_TRANSFER = 'bank_transfer',
}

/** Why a payment no longer counts: money given back, or entered by mistake. */
export enum PaymentVoidType {
    REFUND = 'refund',
    MISTAKE = 'mistake',
}

@Schema({ timestamps: true })
export class Payment {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Invoice',
        required: true,
        index: true,
    })
    invoiceId: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Patient',
        required: true,
    })
    patientId: Types.ObjectId;

    /** Integer in the currency's smallest unit (see money.util). */
    @Prop({ required: true, min: 1 })
    amount: number;

    /** Always the invoice's currency (D3). */
    @Prop({
        required: true,
        enum: Currency,
        default: Currency.AMD,
    })
    currency: Currency;

    @Prop({
        required: true,
        enum: PaymentMethod,
    })
    method: PaymentMethod;

    @Prop({ default: () => new Date() })
    date: Date;

    @Prop({ trim: true })
    reference: string;

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    receivedBy: Types.ObjectId;

    /** Payments are never deleted; a voided one stays with who, when, why. */
    @Prop()
    voidedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    voidedBy: Types.ObjectId;

    @Prop({ enum: PaymentVoidType })
    voidType: PaymentVoidType;

    @Prop({ trim: true })
    voidReason: string;

    @Prop({ enum: ['minor'], default: 'minor' })
    moneyUnits: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ clinicId: 1, invoiceId: 1 });
PaymentSchema.index({ clinicId: 1, date: -1 });
