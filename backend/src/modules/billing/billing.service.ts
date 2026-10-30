import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Connection, FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus, OPEN_STATUSES } from './invoice.schema';
import { Payment, PaymentDocument } from './payment.schema';
import { Patient, PatientDocument } from 'src/modules/patients/patient.schema';
import { patientSearchClauses } from 'src/modules/patients/patient-search';
import {
    TreatmentEntry,
    TreatmentEntryDocument,
    TreatmentEntryStatus,
} from 'src/modules/dental-records/treatment-entry.schema';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { NotificationsService, personName } from 'src/modules/notifications/notifications.service';
import { NotificationRelatedType, NotificationType } from 'src/modules/notifications/notification.schema';
import { runOnce } from 'src/common/migrations/run-once';
import { Role } from 'src/common/decorators';
import {
    Currency,
    MINOR_DIGITS,
    clinicDateSpan,
    errorBody,
    escapeRegex,
    roundMinor,
    toClinicDateString,
    toMajor,
    toMinor,
} from 'src/common/utils';
import {
    CreateInvoiceDto,
    UpdateInvoiceDto,
    CreatePaymentDto,
    QueryInvoiceDto,
    InvoiceItemDto,
    VoidPaymentDto,
} from './dto';

const PERSON = 'firstName lastName';

const INVOICE_POPULATE = [
    { path: 'patientId', select: 'firstName lastName patronymic phone email' },
    { path: 'appointmentId', select: 'title startTime endTime' },
    { path: 'createdBy', select: PERSON },
    { path: 'issuedBy', select: PERSON },
    { path: 'cancelledBy', select: PERSON },
    { path: 'items.treatmentId', select: 'name nameHy nameRu code' },
];

const PAYMENT_POPULATE = [
    { path: 'receivedBy', select: PERSON },
    { path: 'voidedBy', select: PERSON },
];

const ITEM_MONEY = ['unitPrice', 'total'] as const;
const INVOICE_MONEY = ['subtotal', 'discountTotal', 'taxAmount', 'totalAmount', 'paidAmount'] as const;

/**
 * Recomputes the status from the amounts, inside an update pipeline, so a
 * payment or refund and its status change are one atomic write.
 */
const STATUS_FROM_AMOUNTS: PipelineStage.Set = {
    $set: {
        status: {
            $switch: {
                branches: [
                    { case: { $gte: ['$paidAmount', '$totalAmount'] }, then: InvoiceStatus.PAID },
                    { case: { $gt: ['$paidAmount', 0] }, then: InvoiceStatus.PARTIAL },
                ],
                default: InvoiceStatus.ISSUED,
            },
        },
    },
};

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

const asId = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

@Injectable()
export class BillingService implements OnModuleInit {
    private readonly logger = new Logger(BillingService.name);

    constructor(
        @InjectModel(Invoice.name)
        private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Payment.name)
        private readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(Patient.name)
        private readonly patientModel: Model<PatientDocument>,
        @InjectModel(TreatmentEntry.name)
        private readonly entryModel: Model<TreatmentEntryDocument>,
        @InjectConnection() private readonly connection: Connection,
        private readonly clinicRefs: ClinicRefsService,
        private readonly notifications: NotificationsService,
    ) {}

    /** Money moved on an invoice: tell the people who look after it (never the one who did it). */
    private notifyPayment(
        clinicId: Types.ObjectId,
        type: NotificationType,
        recipients: (Types.ObjectId | string | undefined)[],
        actorId: Types.ObjectId,
        invoice: Record<string, any>,
        payment: Record<string, any>,
    ) {
        return this.notifications.notify({
            clinicId,
            recipients,
            actorId,
            type,
            relatedId: invoice._id,
            relatedType: NotificationRelatedType.INVOICE,
            data: {
                patientName: personName(invoice.patientId),
                invoiceNumber: invoice.invoiceNumber,
                amount: payment.amount,
                currency: payment.currency,
                ...(payment.voidReason ? { reason: payment.voidReason, voidType: payment.voidType } : {}),
            },
        });
    }

    /** One-off data fixes; each runs once per database (see `runOnce`). */
    async onModuleInit(): Promise<void> {
        await runOnce(this.connection, '2026-10-billing-integer-money', this.logger, () => this.convertToMinorUnits());
        await runOnce(this.connection, '2026-10-invoice-status-lifecycle', this.logger, () => this.migrateStatuses());
    }

    /**
     * Decimal amounts → integers in the smallest unit (D2). Each document is
     * marked (`moneyUnits`), so an interrupted run never converts twice.
     */
    private async convertToMinorUnits(): Promise<number> {
        const scale = (value: unknown, currency: Currency) =>
            typeof value === 'number' ? Math.round(value * 10 ** (MINOR_DIGITS[currency] ?? 2)) : value;
        let changed = 0;

        const invoices = this.invoiceModel.collection;
        const invoiceOps: AnyBulkWriteOperation[] = [];
        for await (const inv of invoices.find({ moneyUnits: { $ne: 'minor' } })) {
            const currency = (inv.currency as Currency) || Currency.AMD;
            const $set: Record<string, unknown> = { moneyUnits: 'minor' };
            for (const field of INVOICE_MONEY) $set[field] = scale(inv[field] ?? 0, currency);
            $set.items = (inv.items ?? []).map((item: Record<string, unknown>) => ({
                ...item,
                ...Object.fromEntries(ITEM_MONEY.map((f) => [f, scale(item[f], currency)])),
            }));
            invoiceOps.push({ updateOne: { filter: { _id: inv._id, moneyUnits: { $ne: 'minor' } }, update: { $set } } });
        }
        if (invoiceOps.length) changed += (await invoices.bulkWrite(invoiceOps)).modifiedCount;

        const payments = this.paymentModel.collection;
        const paymentOps: AnyBulkWriteOperation[] = [];
        for await (const pay of payments.find({ moneyUnits: { $ne: 'minor' } })) {
            const currency = (pay.currency as Currency) || Currency.AMD;
            paymentOps.push({
                updateOne: {
                    filter: { _id: pay._id, moneyUnits: { $ne: 'minor' } },
                    update: { $set: { amount: scale(pay.amount, currency), moneyUnits: 'minor' } },
                },
            });
        }
        if (paymentOps.length) changed += (await payments.bulkWrite(paymentOps)).modifiedCount;

        if (changed) this.logger.log(`Converted ${changed} invoices/payments to integer amounts`);
        return changed;
    }

    /** `pending` becomes `issued`; the never-set `overdue` status is derived from amounts. */
    private async migrateStatuses(): Promise<number> {
        const invoices = this.invoiceModel.collection;
        const pending = await invoices.updateMany({ status: 'pending' }, [
            { $set: { issuedAt: { $ifNull: ['$issuedAt', '$createdAt'] } } },
            STATUS_FROM_AMOUNTS,
        ]);
        const overdue = await invoices.updateMany({ status: 'overdue' }, [STATUS_FROM_AMOUNTS]);
        return pending.modifiedCount + overdue.modifiedCount;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Amounts leave the API in major units (dram, dollars), with `balance`
     * and a computed `isOverdue`. Every response goes through this.
     */
    private serializeInvoice(invoice: InvoiceDocument | Record<string, any>, todayStart: Date) {
        const raw: Record<string, any> =
            typeof (invoice as InvoiceDocument).toObject === 'function'
                ? (invoice as InvoiceDocument).toObject()
                : { ...invoice };
        const currency = raw.currency as Currency;
        const major = (value: number) => toMajor(value ?? 0, currency);
        const out: Record<string, any> = { ...raw };
        for (const field of INVOICE_MONEY) out[field] = major(raw[field]);
        out.items = (raw.items ?? []).map((item: Record<string, any>) => ({
            ...item,
            unitPrice: major(item.unitPrice),
            total: major(item.total),
        }));
        out.balance = major((raw.totalAmount ?? 0) - (raw.paidAmount ?? 0));
        out.isOverdue =
            OPEN_STATUSES.includes(raw.status) && !!raw.dueDate && new Date(raw.dueDate) < todayStart;
        delete out.moneyUnits;
        return out;
    }

    private serializePayment(payment: PaymentDocument | Record<string, any>) {
        const raw: Record<string, any> =
            typeof (payment as PaymentDocument).toObject === 'function'
                ? (payment as PaymentDocument).toObject()
                : { ...payment };
        const out: Record<string, any> = { ...raw, amount: toMajor(raw.amount, raw.currency as Currency) };
        delete out.moneyUnits;
        return out;
    }

    /** UTC midnight of the clinic's today: a due date before it is overdue. */
    private async todayStart(clinicId: Types.ObjectId): Promise<Date> {
        const { timezone } = await this.clinicRefs.localeOf(clinicId);
        return new Date(`${toClinicDateString(new Date(), timezone)}T00:00:00.000Z`);
    }

    /** The clinic's currency (D3). A request naming another one is refused rather than silently changed. */
    private async billingCurrency(clinicId: Types.ObjectId, requested?: Currency): Promise<Currency> {
        const { currency } = await this.clinicRefs.localeOf(clinicId);
        if (requested && requested !== currency) {
            throw new BadRequestException(
                errorBody('currencyMismatch', `This clinic bills in ${currency}`),
            );
        }
        return currency;
    }

    /**
     * `INV-2026-00042`: a per-clinic, per-year counter incremented atomically.
     * The old "find the last number and add one" gave two parallel requests
     * the same number, and the unique index turned the loser into a 500.
     */
    private async nextInvoiceNumber(clinicId: Types.ObjectId): Promise<string> {
        const { timezone } = await this.clinicRefs.localeOf(clinicId);
        const year = toClinicDateString(new Date(), timezone).slice(0, 4);
        const counters = this.connection.collection<{ _id: string; seq: number }>('counters');
        const key = `invoice:${clinicId}:${year}`;
        for (let attempt = 0; ; attempt++) {
            try {
                const counter = await counters.findOneAndUpdate(
                    { _id: key },
                    { $inc: { seq: 1 } },
                    { upsert: true, returnDocument: 'after' },
                );
                const seq = (counter as any)?.value?.seq ?? (counter as any)?.seq;
                return `INV-${year}-${String(seq).padStart(5, '0')}`;
            } catch (err) {
                // Two first invoices of the year: both upserts insert, one loses.
                if (!isDuplicateKey(err) || attempt >= 2) throw err;
            }
        }
    }

    /** Lines, subtotal, discount and total in integer minor units. */
    private calculateTotals(items: InvoiceItemDto[], taxAmount: number, currency: Currency) {
        let subtotal = 0;
        let discountTotal = 0;

        const calculatedItems = items.map((item) => {
            const quantity = item.quantity ?? 1;
            const discount = item.discount ?? 0;
            const unitPrice = toMinor(item.unitPrice, currency);
            const gross = quantity * unitPrice;
            const lineDiscount = roundMinor((gross * discount) / 100);
            subtotal += gross;
            discountTotal += lineDiscount;

            return {
                treatmentId: item.treatmentId ? new Types.ObjectId(item.treatmentId) : undefined,
                treatmentEntryId: item.treatmentEntryId ? new Types.ObjectId(item.treatmentEntryId) : undefined,
                description: item.description,
                quantity,
                unitPrice,
                discount,
                total: gross - lineDiscount,
            };
        });

        const tax = toMinor(taxAmount, currency);
        return { calculatedItems, subtotal, discountTotal, taxAmount: tax, totalAmount: subtotal - discountTotal + tax };
    }

    private entryIdsOf(items: { treatmentEntryId?: string | Types.ObjectId }[] = []): string[] {
        const ids = items.map((i) => i.treatmentEntryId?.toString()).filter((id): id is string => !!id);
        if (new Set(ids).size !== ids.length) {
            throw new BadRequestException(errorBody('duplicateTreatmentLine', 'A treatment can be billed only once'));
        }
        return ids;
    }

    /**
     * Mark done chart entries as billed by this invoice — all or none. An
     * entry already on another live invoice, voided or not done is refused.
     */
    private async claimEntries(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        entryIds: string[],
        invoiceId: Types.ObjectId,
    ): Promise<void> {
        if (!entryIds.length) return;
        const ids = entryIds.map(asId);
        const res = await this.entryModel.updateMany(
            {
                _id: { $in: ids },
                clinicId,
                patientId,
                status: TreatmentEntryStatus.DONE,
                voidedAt: null,
                invoiceId: null,
            },
            { $set: { invoiceId } },
        );
        if (res.modifiedCount !== ids.length) {
            await this.releaseEntries(invoiceId, entryIds);
            throw new ConflictException(
                errorBody('treatmentAlreadyBilled', 'A treatment is already billed, voided or not done yet'),
            );
        }
    }

    private async releaseEntries(invoiceId: Types.ObjectId, entryIds?: string[]): Promise<void> {
        await this.entryModel.updateMany(
            { invoiceId, ...(entryIds ? { _id: { $in: entryIds.map(asId) } } : {}) },
            { $unset: { invoiceId: '' } },
        );
    }

    private notFound(): NotFoundException {
        return new NotFoundException(errorBody('invoiceNotFound', 'Invoice not found'));
    }

    /** Why a conditional write on an invoice matched nothing. */
    private async invoiceStateError(clinicId: Types.ObjectId, invoiceId: Types.ObjectId) {
        const invoice = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).lean();
        if (!invoice) return this.notFound();
        const byStatus: Partial<Record<InvoiceStatus, [string, string]>> = {
            [InvoiceStatus.DRAFT]: ['invoiceNotIssued', 'Issue the invoice first'],
            [InvoiceStatus.PAID]: ['invoiceAlreadyPaid', 'Invoice is already fully paid'],
            [InvoiceStatus.CANCELLED]: ['invoiceCancelled', 'Invoice is cancelled'],
        };
        const [code, message] = byStatus[invoice.status] ?? ['invoiceChanged', 'The invoice was changed. Reload it.'];
        return new BadRequestException(errorBody(code, message));
    }

    // ── Invoices ─────────────────────────────────────────────────────────────

    /**
     * Create an invoice, as a draft or issued right away. Lines may bill done
     * chart entries; those are claimed first so no treatment is billed twice.
     */
    async createInvoice(clinicId: Types.ObjectId, userId: Types.ObjectId, dto: CreateInvoiceDto) {
        const patientId = new Types.ObjectId(dto.patientId);
        // Body ids must belong to this clinic, or populate leaks another clinic's patient.
        await Promise.all([
            this.clinicRefs.assertPatient(clinicId, patientId, { forBooking: true }),
            dto.appointmentId && this.clinicRefs.assertAppointment(clinicId, dto.appointmentId, patientId),
            this.clinicRefs.assertTreatments(clinicId, dto.items.map((i) => i.treatmentId).filter(Boolean)),
        ]);

        const currency = await this.billingCurrency(clinicId, dto.currency);
        const totals = this.calculateTotals(dto.items, dto.taxAmount ?? 0, currency);
        if (dto.issue && totals.totalAmount <= 0) {
            throw new BadRequestException(errorBody('invoiceEmpty', 'An invoice needs a total above zero to be issued'));
        }

        const _id = new Types.ObjectId();
        const entryIds = this.entryIdsOf(dto.items);
        await this.claimEntries(clinicId, patientId, entryIds, _id);

        const now = new Date();
        try {
            await this.invoiceModel.create({
                _id,
                clinicId,
                patientId,
                appointmentId: dto.appointmentId ? new Types.ObjectId(dto.appointmentId) : undefined,
                invoiceNumber: await this.nextInvoiceNumber(clinicId),
                items: totals.calculatedItems,
                subtotal: totals.subtotal,
                discountTotal: totals.discountTotal,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                paidAmount: 0,
                currency,
                status: dto.issue ? InvoiceStatus.ISSUED : InvoiceStatus.DRAFT,
                issuedAt: dto.issue ? now : undefined,
                issuedBy: dto.issue ? userId : undefined,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                notes: dto.notes,
                createdBy: userId,
            });
        } catch (err) {
            await this.releaseEntries(_id);
            throw err;
        }

        return this.findInvoiceById(clinicId, _id);
    }

    /**
     * Invoices with filters (status incl. `overdue`, patient, invoice number /
     * patient name / phone search, created-date range in clinic days) and pages.
     */
    async findAllInvoices(clinicId: Types.ObjectId, query: QueryInvoiceDto) {
        const { page = 1, limit = 20, status, patientId, startDate, endDate, search } = query;
        const { timezone } = await this.clinicRefs.localeOf(clinicId);
        const todayStart = await this.todayStart(clinicId);

        const filter: FilterQuery<InvoiceDocument> = { clinicId };

        if (status === 'overdue') {
            filter.status = { $in: OPEN_STATUSES };
            filter.dueDate = { $lt: todayStart };
        } else if (status) {
            filter.status = status;
        }

        if (patientId) filter.patientId = new Types.ObjectId(patientId);

        if (startDate || endDate) {
            const span = clinicDateSpan(startDate?.slice(0, 10), endDate?.slice(0, 10), timezone);
            filter.createdAt = {};
            if (span.start) filter.createdAt.$gte = span.start;
            if (span.end) filter.createdAt.$lt = span.end;
        }

        if (search?.trim()) {
            const patients = await this.patientModel
                .find({ clinicId, $and: patientSearchClauses(search) })
                .select('_id')
                .limit(500)
                .lean();
            filter.$or = [
                { invoiceNumber: new RegExp(escapeRegex(search.trim()), 'i') },
                { patientId: { $in: patients.map((p) => p._id) } },
            ];
        }

        const [data, total] = await Promise.all([
            this.invoiceModel
                .find(filter)
                .populate('patientId', 'firstName lastName patronymic phone')
                .populate('createdBy', PERSON)
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.invoiceModel.countDocuments(filter),
        ]);

        return {
            data: data.map((invoice) => this.serializeInvoice(invoice, todayStart)),
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async findInvoiceById(clinicId: Types.ObjectId, invoiceId: Types.ObjectId) {
        const invoice = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).populate(INVOICE_POPULATE).lean();
        if (!invoice) throw this.notFound();
        return this.serializeInvoice(invoice, await this.todayStart(clinicId));
    }

    /** Drafts only. Billed chart entries follow the lines: new ones are claimed, removed ones released. */
    async updateInvoice(clinicId: Types.ObjectId, invoiceId: Types.ObjectId, dto: UpdateInvoiceDto) {
        const invoice = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).lean();
        if (!invoice) throw this.notFound();
        if (invoice.status !== InvoiceStatus.DRAFT) {
            throw new BadRequestException(errorBody('invoiceNotEditable', 'Only draft invoices can be edited'));
        }

        const $set: Record<string, unknown> = {};
        const $unset: Record<string, ''> = {};
        let claimed: string[] = [];
        let released: string[] = [];

        if (dto.items || dto.taxAmount !== undefined) {
            const items = dto.items;
            if (items) {
                await this.clinicRefs.assertTreatments(clinicId, items.map((i) => i.treatmentId).filter(Boolean));
            }
            const currentItems: InvoiceItemDto[] = invoice.items.map((i) => ({
                treatmentId: i.treatmentId?.toString(),
                treatmentEntryId: i.treatmentEntryId?.toString(),
                description: i.description,
                quantity: i.quantity,
                unitPrice: toMajor(i.unitPrice, invoice.currency),
                discount: i.discount,
            }));
            const totals = this.calculateTotals(
                items ?? currentItems,
                dto.taxAmount ?? toMajor(invoice.taxAmount, invoice.currency),
                invoice.currency,
            );
            Object.assign($set, {
                items: totals.calculatedItems,
                subtotal: totals.subtotal,
                discountTotal: totals.discountTotal,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
            });

            if (items) {
                const before = this.entryIdsOf(currentItems);
                const after = this.entryIdsOf(items);
                claimed = after.filter((id) => !before.includes(id));
                released = before.filter((id) => !after.includes(id));
                await this.claimEntries(clinicId, invoice.patientId, claimed, invoiceId);
            }
        }

        if (dto.dueDate === '') $unset.dueDate = '';
        else if (dto.dueDate !== undefined) $set.dueDate = new Date(dto.dueDate);
        if (dto.notes !== undefined) $set.notes = dto.notes;

        const updated = await this.invoiceModel.findOneAndUpdate(
            { _id: invoiceId, clinicId, status: InvoiceStatus.DRAFT },
            { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
            { new: true, runValidators: true },
        );
        if (!updated) {
            // Issued or cancelled meanwhile: give back what we just claimed.
            if (claimed.length) await this.releaseEntries(invoiceId, claimed);
            throw await this.invoiceStateError(clinicId, invoiceId);
        }
        if (released.length) await this.releaseEntries(invoiceId, released);

        return this.findInvoiceById(clinicId, invoiceId);
    }

    /** Draft → issued. Only issued invoices take payments and count as debt. */
    async issueInvoice(clinicId: Types.ObjectId, invoiceId: Types.ObjectId, userId: Types.ObjectId) {
        const updated = await this.invoiceModel.findOneAndUpdate(
            { _id: invoiceId, clinicId, status: InvoiceStatus.DRAFT, totalAmount: { $gt: 0 } },
            { $set: { status: InvoiceStatus.ISSUED, issuedAt: new Date(), issuedBy: userId } },
        );
        if (!updated) {
            const invoice = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).lean();
            if (invoice?.status === InvoiceStatus.DRAFT) {
                throw new BadRequestException(
                    errorBody('invoiceEmpty', 'An invoice needs a total above zero to be issued'),
                );
            }
            if (invoice) throw new BadRequestException(errorBody('invoiceAlreadyIssued', 'Invoice is already issued'));
            throw this.notFound();
        }
        return this.findInvoiceById(clinicId, invoiceId);
    }

    /**
     * Cancel an invoice nothing is paid on (refund payments first). Anyone who
     * bills may cancel a draft; an issued invoice needs the clinic admin.
     * Billed chart entries become billable again.
     */
    async cancelInvoice(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
        userId: Types.ObjectId,
        role: Role,
        reason: string,
    ) {
        const isAdmin = [Role.CLINIC_ADMIN, Role.SUPER_ADMIN].includes(role);
        const cancellable = isAdmin ? [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED] : [InvoiceStatus.DRAFT];

        const updated = await this.invoiceModel.findOneAndUpdate(
            { _id: invoiceId, clinicId, status: { $in: cancellable }, paidAmount: 0 },
            {
                $set: {
                    status: InvoiceStatus.CANCELLED,
                    cancelledAt: new Date(),
                    cancelledBy: userId,
                    cancelReason: reason,
                },
            },
        );

        if (!updated) {
            const invoice = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).lean();
            if (!invoice) throw this.notFound();
            if (invoice.status === InvoiceStatus.CANCELLED) {
                throw new BadRequestException(errorBody('invoiceCancelled', 'Invoice is already cancelled'));
            }
            if (invoice.paidAmount > 0) {
                throw new BadRequestException(
                    errorBody('invoiceHasPayments', 'Refund the payments before cancelling this invoice'),
                );
            }
            if (!isAdmin) {
                throw new ForbiddenException(
                    errorBody('cancelIssuedForbidden', 'Only the clinic admin can cancel an issued invoice'),
                );
            }
            throw await this.invoiceStateError(clinicId, invoiceId);
        }

        await this.releaseEntries(invoiceId);
        return this.findInvoiceById(clinicId, invoiceId);
    }

    // ── Payments ─────────────────────────────────────────────────────────────

    /**
     * Record a payment. The balance check, the amount and the status change
     * are one conditional update, so two cashiers taking the last payment at
     * once cannot both succeed (that used to overpay or lose a payment). If
     * storing the payment then fails, the invoice is put back.
     */
    async addPayment(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: CreatePaymentDto,
    ) {
        const current = await this.invoiceModel
            .findOne({ _id: invoiceId, clinicId })
            .select('currency patientId totalAmount paidAmount')
            .lean();
        if (!current) throw this.notFound();

        if (dto.currency && dto.currency !== current.currency) {
            throw new BadRequestException(
                errorBody('currencyMismatch', `This invoice is in ${current.currency}`),
            );
        }
        const amount = toMinor(dto.amount, current.currency);
        if (dto.date && new Date(dto.date).getTime() > Date.now() + 24 * 3600 * 1000) {
            throw new BadRequestException(errorBody('paymentInFuture', 'A payment cannot be dated in the future'));
        }

        const updated = await this.invoiceModel.findOneAndUpdate(
            {
                _id: invoiceId,
                clinicId,
                status: { $in: OPEN_STATUSES },
                $expr: { $lte: [{ $add: ['$paidAmount', amount] }, '$totalAmount'] },
            },
            [{ $set: { paidAmount: { $add: ['$paidAmount', amount] } } }, STATUS_FROM_AMOUNTS],
            { new: true },
        );

        if (!updated) {
            const fresh = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).lean();
            if (fresh && OPEN_STATUSES.includes(fresh.status)) {
                const remaining = toMajor(fresh.totalAmount - fresh.paidAmount, fresh.currency);
                throw new BadRequestException({
                    ...errorBody('paymentExceedsBalance', `The remaining balance is ${remaining} ${fresh.currency}`),
                    remaining,
                    currency: fresh.currency,
                });
            }
            throw await this.invoiceStateError(clinicId, invoiceId);
        }

        let payment: PaymentDocument;
        try {
            payment = await this.paymentModel.create({
                clinicId,
                invoiceId,
                patientId: current.patientId,
                amount,
                currency: current.currency,
                method: dto.method,
                date: dto.date ? new Date(dto.date) : new Date(),
                reference: dto.reference,
                notes: dto.notes,
                receivedBy: userId,
            });
        } catch (err) {
            await this.invoiceModel.updateOne({ _id: invoiceId }, [
                { $set: { paidAmount: { $subtract: ['$paidAmount', amount] } } },
                STATUS_FROM_AMOUNTS,
            ]);
            throw err;
        }

        await payment.populate(PAYMENT_POPULATE);
        const result = { payment: this.serializePayment(payment), invoice: await this.findInvoiceById(clinicId, invoiceId) };
        await this.notifyPayment(
            clinicId,
            NotificationType.PAYMENT_RECEIVED,
            await this.notifications.staffWithRoles(clinicId, [Role.CLINIC_ADMIN]),
            userId,
            result.invoice,
            result.payment,
        );
        return result;
    }

    /**
     * Refund or void a payment (admin). It stays on record with who, when,
     * why; the invoice's paid amount and status go back accordingly.
     */
    async voidPayment(
        clinicId: Types.ObjectId,
        invoiceId: Types.ObjectId,
        paymentId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: VoidPaymentDto,
    ) {
        const payment = await this.paymentModel.findOneAndUpdate(
            { _id: paymentId, invoiceId, clinicId, voidedAt: null },
            { $set: { voidedAt: new Date(), voidedBy: userId, voidType: dto.type, voidReason: dto.reason } },
            { new: true },
        );
        if (!payment) {
            const exists = await this.paymentModel.exists({ _id: paymentId, invoiceId, clinicId });
            if (exists) throw new BadRequestException(errorBody('paymentAlreadyVoided', 'This payment was already voided'));
            throw new NotFoundException(errorBody('paymentNotFound', 'Payment not found'));
        }

        const res = await this.invoiceModel.updateOne(
            { _id: invoiceId, clinicId, paidAmount: { $gte: payment.amount } },
            [{ $set: { paidAmount: { $subtract: ['$paidAmount', payment.amount] } } }, STATUS_FROM_AMOUNTS],
        );
        if (!res.modifiedCount) {
            await this.paymentModel.updateOne(
                { _id: paymentId },
                { $unset: { voidedAt: '', voidedBy: '', voidType: '', voidReason: '' } },
            );
            throw await this.invoiceStateError(clinicId, invoiceId);
        }

        const receivedBy = payment.receivedBy?.toString();
        await payment.populate(PAYMENT_POPULATE);
        const result = { payment: this.serializePayment(payment), invoice: await this.findInvoiceById(clinicId, invoiceId) };
        // The cashier who took it should know it was given back.
        await this.notifyPayment(clinicId, NotificationType.PAYMENT_REFUNDED, [receivedBy], userId, result.invoice, result.payment);
        return result;
    }

    async getPaymentsByInvoice(clinicId: Types.ObjectId, invoiceId: Types.ObjectId) {
        if (!(await this.invoiceModel.exists({ _id: invoiceId, clinicId }))) throw this.notFound();
        const payments = await this.paymentModel
            .find({ clinicId, invoiceId })
            .populate(PAYMENT_POPULATE)
            .sort({ date: -1, _id: -1 })
            .lean();
        return payments.map((p) => this.serializePayment(p));
    }

    // ── Patient & stats ─────────────────────────────────────────────────────

    /**
     * What the patient owes, per currency. Drafts and cancelled invoices are
     * not debt (the patient tab used to count cancelled invoices).
     */
    async getPatientSummary(clinicId: Types.ObjectId, patientId: Types.ObjectId) {
        const todayStart = await this.todayStart(clinicId);
        const rows = await this.invoiceModel.aggregate<{
            _id: Currency;
            billed: number;
            paid: number;
            invoices: number;
            overdue: number;
        }>([
            { $match: { clinicId, patientId, status: { $in: [...OPEN_STATUSES, InvoiceStatus.PAID] } } },
            {
                $group: {
                    _id: '$currency',
                    billed: { $sum: '$totalAmount' },
                    paid: { $sum: '$paidAmount' },
                    invoices: { $sum: 1 },
                    overdue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $in: ['$status', OPEN_STATUSES] },
                                        { $lt: ['$dueDate', todayStart] },
                                        { $ne: [{ $ifNull: ['$dueDate', null] }, null] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const unbilled = await this.entryModel.countDocuments({
            clinicId,
            patientId,
            status: TreatmentEntryStatus.DONE,
            voidedAt: null,
            invoiceId: null,
        });

        return {
            byCurrency: rows.map((r) => ({
                currency: r._id,
                billed: toMajor(r.billed, r._id),
                paid: toMajor(r.paid, r._id),
                balance: toMajor(r.billed - r.paid, r._id),
                invoices: r.invoices,
                overdue: r.overdue,
            })),
            unbilledTreatments: unbilled,
        };
    }

    /** Done chart entries not yet on a live invoice — the "bill these treatments" list. */
    async getUnbilledTreatments(clinicId: Types.ObjectId, patientId: Types.ObjectId) {
        return this.entryModel
            .find({ clinicId, patientId, status: TreatmentEntryStatus.DONE, voidedAt: null, invoiceId: null })
            .sort({ date: -1, _id: -1 })
            .limit(100)
            .populate('treatmentId', 'name nameHy nameRu code price')
            .populate('dentistId', PERSON)
            .lean();
    }
}
