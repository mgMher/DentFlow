import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus } from './invoice.schema';
import { Payment, PaymentDocument } from './payment.schema';
import {
    CreateInvoiceDto,
    UpdateInvoiceDto,
    CreatePaymentDto,
    QueryInvoiceDto,
    InvoiceItemDto,
} from './dto';

@Injectable()
export class BillingService {
    constructor(
        @InjectModel(Invoice.name)
        private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Payment.name)
        private readonly paymentModel: Model<PaymentDocument>,
    ) {}

    /**
     * Generate a unique invoice number for the clinic.
     * Format: INV-YYYYMMDD-XXXX where XXXX is a zero-padded sequential counter per day per clinic.
     */
    async generateInvoiceNumber(clinicId: Types.ObjectId): Promise<string> {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePrefix = `INV-${year}${month}${day}-`;

        const lastInvoice = await this.invoiceModel
            .findOne({
                clinicId,
                invoiceNumber: { $regex: `^${datePrefix}` },
            })
            .sort({ invoiceNumber: -1 })
            .select('invoiceNumber')
            .lean()
            .exec();

        let sequence = 1;
        if (lastInvoice) {
            const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop(), 10);
            if (!isNaN(lastSequence)) {
                sequence = lastSequence + 1;
            }
        }

        return `${datePrefix}${String(sequence).padStart(4, '0')}`;
    }

    /**
     * Calculate item totals, subtotal, discountTotal, and totalAmount from line items.
     */
    private calculateTotals(items: InvoiceItemDto[], taxAmount: number = 0) {
        let subtotal = 0;
        let discountTotal = 0;

        const calculatedItems = items.map((item) => {
            const quantity = item.quantity ?? 1;
            const discount = item.discount ?? 0;
            const lineGross = quantity * item.unitPrice;
            const lineDiscount = lineGross * (discount / 100);
            const lineTotal = lineGross - lineDiscount;

            subtotal += lineGross;
            discountTotal += lineDiscount;

            return {
                treatmentId: item.treatmentId
                    ? new Types.ObjectId(item.treatmentId)
                    : undefined,
                description: item.description,
                quantity,
                unitPrice: item.unitPrice,
                discount,
                total: Math.round(lineTotal * 100) / 100,
            };
        });

        subtotal = Math.round(subtotal * 100) / 100;
        discountTotal = Math.round(discountTotal * 100) / 100;
        const totalAmount = Math.round((subtotal - discountTotal + taxAmount) * 100) / 100;

        return { calculatedItems, subtotal, discountTotal, totalAmount };
    }

    /**
     * Create a new invoice for the clinic.
     * Generates the invoice number and calculates all totals from line items.
     */
    async createInvoice(
        clinicId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: CreateInvoiceDto,
    ): Promise<InvoiceDocument> {
        const invoiceNumber = await this.generateInvoiceNumber(clinicId);
        const taxAmount = dto.taxAmount ?? 0;
        const { calculatedItems, subtotal, discountTotal, totalAmount } =
            this.calculateTotals(dto.items, taxAmount);

        const invoice = new this.invoiceModel({
            clinicId,
            patientId: new Types.ObjectId(dto.patientId),
            appointmentId: dto.appointmentId
                ? new Types.ObjectId(dto.appointmentId)
                : undefined,
            invoiceNumber,
            items: calculatedItems,
            subtotal,
            discountTotal,
            taxAmount,
            totalAmount,
            paidAmount: 0,
            currency: dto.currency,
            status: InvoiceStatus.DRAFT,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            notes: dto.notes,
            createdBy: userId,
        });

        return invoice.save();
    }

    /**
     * List invoices for the clinic with optional filters and pagination.
     */
    async findAllInvoices(
        clinicId: Types.ObjectId,
        query: QueryInvoiceDto,
    ): Promise<{
        data: InvoiceDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const { page = 1, limit = 20, status, patientId, startDate, endDate } = query;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<InvoiceDocument> = { clinicId };

        if (status) {
            filter.status = status;
        }

        if (patientId) {
            filter.patientId = new Types.ObjectId(patientId);
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        const [data, total] = await Promise.all([
            this.invoiceModel
                .find(filter)
                .populate('patientId', 'firstName lastName phone')
                .populate('createdBy', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.invoiceModel.countDocuments(filter).exec(),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Retrieve a single invoice by ID, scoped to the clinic.
     */
    async findInvoiceById(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
    ): Promise<InvoiceDocument> {
        const invoice = await this.invoiceModel
            .findOne({ _id: invoiceId, clinicId })
            .populate('patientId', 'firstName lastName phone email')
            .populate('appointmentId', 'title startTime endTime')
            .populate('createdBy', 'firstName lastName')
            .populate('items.treatmentId', 'name code category')
            .exec();

        if (!invoice) {
            throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
        }

        return invoice;
    }

    /**
     * Update an invoice. Only allowed when the invoice is in DRAFT status.
     * Recalculates totals if items are provided.
     */
    async updateInvoice(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
        dto: UpdateInvoiceDto,
    ): Promise<InvoiceDocument> {
        const invoice = await this.invoiceModel
            .findOne({ _id: invoiceId, clinicId })
            .exec();

        if (!invoice) {
            throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
        }

        if (invoice.status !== InvoiceStatus.DRAFT) {
            throw new BadRequestException(
                `Cannot update invoice in "${invoice.status}" status. Only draft invoices can be edited.`,
            );
        }

        const updateData: Record<string, any> = {};

        if (dto.items) {
            const taxAmount = dto.taxAmount ?? invoice.taxAmount;
            const { calculatedItems, subtotal, discountTotal, totalAmount } =
                this.calculateTotals(dto.items, taxAmount);

            updateData.items = calculatedItems;
            updateData.subtotal = subtotal;
            updateData.discountTotal = discountTotal;
            updateData.totalAmount = totalAmount;
            updateData.taxAmount = taxAmount;
        } else if (dto.taxAmount !== undefined) {
            updateData.taxAmount = dto.taxAmount;
            updateData.totalAmount =
                Math.round((invoice.subtotal - invoice.discountTotal + dto.taxAmount) * 100) / 100;
        }

        if (dto.currency !== undefined) {
            updateData.currency = dto.currency;
        }
        if (dto.dueDate !== undefined) {
            updateData.dueDate = new Date(dto.dueDate);
        }
        if (dto.notes !== undefined) {
            updateData.notes = dto.notes;
        }

        const updated = await this.invoiceModel
            .findOneAndUpdate(
                { _id: invoiceId, clinicId },
                { $set: updateData },
                { new: true, runValidators: true },
            )
            .exec();

        return updated;
    }

    /**
     * Cancel an invoice. Cannot cancel invoices that are already fully paid.
     */
    async cancelInvoice(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
    ): Promise<InvoiceDocument> {
        const invoice = await this.invoiceModel
            .findOne({ _id: invoiceId, clinicId })
            .exec();

        if (!invoice) {
            throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
        }

        if (invoice.status === InvoiceStatus.PAID) {
            throw new BadRequestException('Cannot cancel a fully paid invoice');
        }

        if (invoice.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException('Invoice is already cancelled');
        }

        const updated = await this.invoiceModel
            .findOneAndUpdate(
                { _id: invoiceId, clinicId },
                { $set: { status: InvoiceStatus.CANCELLED } },
                { new: true },
            )
            .exec();

        return updated;
    }

    /**
     * Record a payment against an invoice.
     * Updates the invoice paidAmount and status accordingly:
     * - If paidAmount >= totalAmount -> PAID
     * - If paidAmount > 0 but < totalAmount -> PARTIAL
     */
    async addPayment(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: CreatePaymentDto,
    ): Promise<{ payment: PaymentDocument; invoice: InvoiceDocument }> {
        const invoice = await this.invoiceModel
            .findOne({ _id: invoiceId, clinicId })
            .exec();

        if (!invoice) {
            throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
        }

        if (invoice.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException('Cannot add payment to a cancelled invoice');
        }

        if (invoice.status === InvoiceStatus.PAID) {
            throw new BadRequestException('Invoice is already fully paid');
        }

        const remaining = invoice.totalAmount - invoice.paidAmount;
        if (dto.amount > remaining) {
            throw new BadRequestException(
                `Payment amount (${dto.amount}) exceeds remaining balance (${remaining})`,
            );
        }

        const payment = new this.paymentModel({
            clinicId,
            invoiceId,
            patientId: invoice.patientId,
            amount: dto.amount,
            currency: dto.currency || invoice.currency,
            method: dto.method,
            date: dto.date ? new Date(dto.date) : new Date(),
            reference: dto.reference,
            notes: dto.notes,
            receivedBy: userId,
        });

        await payment.save();

        const newPaidAmount = Math.round((invoice.paidAmount + dto.amount) * 100) / 100;
        let newStatus: InvoiceStatus;

        if (newPaidAmount >= invoice.totalAmount) {
            newStatus = InvoiceStatus.PAID;
        } else if (newPaidAmount > 0) {
            newStatus = InvoiceStatus.PARTIAL;
        } else {
            newStatus = invoice.status;
        }

        const updatedInvoice = await this.invoiceModel
            .findOneAndUpdate(
                { _id: invoiceId, clinicId },
                {
                    $set: {
                        paidAmount: newPaidAmount,
                        status: newStatus,
                    },
                },
                { new: true },
            )
            .exec();

        return { payment, invoice: updatedInvoice };
    }

    /**
     * Get all payments for a specific invoice.
     */
    async getPaymentsByInvoice(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
    ): Promise<PaymentDocument[]> {
        const invoice = await this.invoiceModel
            .findOne({ _id: invoiceId, clinicId })
            .select('_id')
            .lean()
            .exec();

        if (!invoice) {
            throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
        }

        return this.paymentModel
            .find({ clinicId, invoiceId })
            .populate('receivedBy', 'firstName lastName')
            .sort({ date: -1 })
            .exec();
    }

    /**
     * Get revenue statistics for the clinic within a date range.
     * Returns total revenue, breakdown by payment method, and daily aggregation.
     */
    async getRevenueStats(
        clinicId: Types.ObjectId,
        startDate?: string,
        endDate?: string,
    ): Promise<{
        totalRevenue: number;
        paymentCount: number;
        byMethod: { method: string; total: number; count: number }[];
        byPeriod: { date: string; total: number; count: number }[];
    }> {
        const matchStage: Record<string, any> = { clinicId };

        if (startDate || endDate) {
            matchStage.date = {};
            if (startDate) {
                matchStage.date.$gte = new Date(startDate);
            }
            if (endDate) {
                matchStage.date.$lte = new Date(endDate);
            }
        }

        const [totals, byMethod, byPeriod] = await Promise.all([
            this.paymentModel.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        paymentCount: { $sum: 1 },
                    },
                },
            ]),
            this.paymentModel.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$method',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { total: -1 } },
            ]),
            this.paymentModel.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$date' },
                        },
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        return {
            totalRevenue: totals[0]?.totalRevenue ?? 0,
            paymentCount: totals[0]?.paymentCount ?? 0,
            byMethod: byMethod.map((item) => ({
                method: item._id,
                total: item.total,
                count: item.count,
            })),
            byPeriod: byPeriod.map((item) => ({
                date: item._id,
                total: item.total,
                count: item.count,
            })),
        };
    }

    /**
     * Get all overdue invoices for the clinic.
     * An invoice is overdue if it has status pending or partial and its dueDate is in the past.
     */
    async getOverdueInvoices(clinicId: Types.ObjectId): Promise<InvoiceDocument[]> {
        const now = new Date();

        return this.invoiceModel
            .find({
                clinicId,
                status: { $in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL] },
                dueDate: { $lt: now },
            })
            .populate('patientId', 'firstName lastName phone')
            .sort({ dueDate: 1 })
            .exec();
    }

    /**
     * Get complete billing history for a specific patient.
     */
    async getPatientBillingHistory(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
    ): Promise<InvoiceDocument[]> {
        return this.invoiceModel
            .find({ clinicId, patientId })
            .populate('appointmentId', 'title startTime endTime')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .exec();
    }
}
