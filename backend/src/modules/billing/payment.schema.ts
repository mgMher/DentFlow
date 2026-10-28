import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentMethod {
    CASH = 'cash',
    CARD = 'card',
    BANK_TRANSFER = 'bank_transfer',
}

export enum PaymentCurrency {
    AMD = 'AMD',
    USD = 'USD',
    RUB = 'RUB',
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

    @Prop({ required: true, min: 0 })
    amount: number;

    @Prop({
        required: true,
        enum: PaymentCurrency,
        default: PaymentCurrency.AMD,
    })
    currency: PaymentCurrency;

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
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ clinicId: 1, invoiceId: 1 });
PaymentSchema.index({ clinicId: 1, date: -1 });
