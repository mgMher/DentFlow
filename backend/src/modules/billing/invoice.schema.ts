import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

export enum InvoiceStatus {
    DRAFT = 'draft',
    PENDING = 'pending',
    PARTIAL = 'partial',
    PAID = 'paid',
    OVERDUE = 'overdue',
    CANCELLED = 'cancelled',
}

export enum InvoiceCurrency {
    AMD = 'AMD',
    USD = 'USD',
    RUB = 'RUB',
}

@Schema({ _id: false })
export class InvoiceItem {
    @Prop({ type: Types.ObjectId, ref: 'Treatment' })
    treatmentId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    description: string;

    @Prop({ required: true, default: 1, min: 1 })
    quantity: number;

    @Prop({ required: true, min: 0 })
    unitPrice: number;

    @Prop({ default: 0, min: 0, max: 100 })
    discount: number;

    @Prop({ required: true, min: 0 })
    total: number;
}

export const InvoiceItemSchema = SchemaFactory.createForClass(InvoiceItem);

@Schema({ timestamps: true })
export class Invoice {
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

    @Prop({
        type: Types.ObjectId,
        ref: 'Appointment',
    })
    appointmentId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    invoiceNumber: string;

    @Prop({ type: [InvoiceItemSchema], default: [] })
    items: InvoiceItem[];

    @Prop({ required: true, min: 0 })
    subtotal: number;

    @Prop({ default: 0, min: 0 })
    discountTotal: number;

    @Prop({ default: 0, min: 0 })
    taxAmount: number;

    @Prop({ required: true, min: 0 })
    totalAmount: number;

    @Prop({ default: 0, min: 0 })
    paidAmount: number;

    @Prop({
        required: true,
        enum: InvoiceCurrency,
        default: InvoiceCurrency.AMD,
    })
    currency: InvoiceCurrency;

    @Prop({
        required: true,
        enum: InvoiceStatus,
        default: InvoiceStatus.DRAFT,
    })
    status: InvoiceStatus;

    @Prop()
    dueDate: Date;

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ clinicId: 1, status: 1 });
InvoiceSchema.index({ clinicId: 1, patientId: 1 });
