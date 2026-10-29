import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Currency } from 'src/common/utils';

export type InvoiceDocument = Invoice & Document;

/**
 * draft → issued → partial → paid, or cancelled from draft/issued while
 * nothing is paid. "Overdue" is not stored: it is an issued or partly paid
 * invoice past its due date, computed when read (it used to be a status
 * nothing ever set).
 */
export enum InvoiceStatus {
    DRAFT = 'draft',
    ISSUED = 'issued',
    PARTIAL = 'partial',
    PAID = 'paid',
    CANCELLED = 'cancelled',
}

/** Statuses a payment can be added to (and that can become overdue). */
export const OPEN_STATUSES = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL];

/** All amounts on invoices and payments are integers in the currency's smallest unit (see money.util). */
@Schema({ _id: false })
export class InvoiceItem {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Treatment' })
    treatmentId: Types.ObjectId;

    /** The chart entry this line bills; an entry is on at most one live invoice. */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TreatmentEntry' })
    treatmentEntryId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    description: string;

    @Prop({ required: true, default: 1, min: 1 })
    quantity: number;

    @Prop({ required: true, min: 0 })
    unitPrice: number;

    /** Percent, 0–100. */
    @Prop({ default: 0, min: 0, max: 100 })
    discount: number;

    @Prop({ required: true, min: 0 })
    total: number;
}

export const InvoiceItemSchema = SchemaFactory.createForClass(InvoiceItem);

@Schema({ timestamps: true })
export class Invoice {
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

    @Prop({
        type: MongooseSchema.Types.ObjectId,
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

    /** Net of voided/refunded payments. */
    @Prop({ default: 0, min: 0 })
    paidAmount: number;

    @Prop({
        required: true,
        enum: Currency,
        default: Currency.AMD,
    })
    currency: Currency;

    @Prop({
        required: true,
        enum: InvoiceStatus,
        default: InvoiceStatus.DRAFT,
    })
    status: InvoiceStatus;

    /** A calendar date (UTC midnight of the day). */
    @Prop()
    dueDate: Date;

    @Prop({ trim: true })
    notes: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;

    @Prop()
    issuedAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    issuedBy: Types.ObjectId;

    @Prop()
    cancelledAt: Date;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    cancelledBy: Types.ObjectId;

    @Prop({ trim: true })
    cancelReason: string;

    /** Invoices written before 2026-10 stored decimals; converted once at startup. */
    @Prop({ enum: ['minor'], default: 'minor' })
    moneyUnits: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ clinicId: 1, status: 1 });
InvoiceSchema.index({ clinicId: 1, patientId: 1 });
InvoiceSchema.index({ clinicId: 1, createdAt: -1 });
