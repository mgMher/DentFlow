import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { Role } from 'src/common/decorators';
import { Currency, errorBody, toMajor, toMinor } from 'src/common/utils';
import { NotificationsService, personName } from 'src/modules/notifications/notifications.service';
import { NotificationRelatedType, NotificationType } from 'src/modules/notifications/notification.schema';
import { Invoice, InvoiceDocument, InvoiceStatus, OPEN_STATUSES } from './invoice.schema';
import { Payment, PaymentDocument } from './payment.schema';
import { Patient, PatientDocument } from 'src/modules/patients/patient.schema';
import { STATUS_FROM_AMOUNTS } from './billing.service';
import { ApplyCreditDto, TakePaymentDto } from './dto/account.dto';
import { VoidPaymentDto } from './dto';

const PERSON = 'firstName lastName';
type Id = Types.ObjectId;

/** One line of a patient's statement. Amounts in major units; `balance` after this line (positive: the patient owes). */
export interface StatementLine {
    date: Date;
    type: 'invoice' | 'invoice_cancelled' | 'payment' | 'payment_voided';
    invoiceId?: Id;
    invoiceNumber?: string;
    paymentId?: Id;
    method?: string;
    onAccount?: boolean;
    fromCredit?: boolean;
    reason?: string;
    charge: number;
    payment: number;
    balance: number;
}

/**
 * The patient's account (F4): what they owe across invoices, money they paid
 * in advance (credit), one payment spread over several invoices, and a
 * statement with a running balance.
 *
 * Credit is money on account: a payment with no invoice. It counts as
 * collected the day it was received; applying it to an invoice later moves
 * it onto that invoice and is not new income.
 */
@Injectable()
export class AccountService {
    constructor(
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        private readonly clinicRefs: ClinicRefsService,
        private readonly notifications: NotificationsService,
    ) {}

    async getAccount(clinicId: Id, patientId: Id) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const { currency } = await this.clinicRefs.localeOf(clinicId);
        const [open, credits] = await Promise.all([
            this.openInvoices(clinicId, patientId, currency),
            this.credits(clinicId, patientId, currency),
        ]);
        const outstanding = open.reduce((s, i) => s + i.totalAmount - i.paidAmount, 0);
        const credit = credits.reduce((s, c) => s + c.amount, 0);
        const major = (v: number) => toMajor(v, currency);
        return {
            currency,
            outstanding: major(outstanding),
            credit: major(credit),
            /** Positive: the patient owes; negative: the clinic holds their money. */
            balance: major(outstanding - credit),
            openInvoices: open.map((i) => ({
                _id: i._id,
                invoiceNumber: i.invoiceNumber,
                issuedAt: i.issuedAt,
                dueDate: i.dueDate,
                status: i.status,
                total: major(i.totalAmount),
                paid: major(i.paidAmount),
                balance: major(i.totalAmount - i.paidAmount),
            })),
            credits: credits.map((c) => ({
                _id: c._id,
                amount: major(c.amount),
                date: c.date,
                method: c.method,
                reference: c.reference,
                receivedBy: c.receivedBy,
            })),
        };
    }

    /** Everything that moved the patient's balance, oldest first, in the clinic currency. */
    async getStatement(clinicId: Id, patientId: Id) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const { currency } = await this.clinicRefs.localeOf(clinicId);
        const [invoices, payments] = await Promise.all([
            this.invoiceModel
                .find({ clinicId, patientId, currency, issuedAt: { $ne: null } })
                .select('invoiceNumber totalAmount issuedAt status cancelledAt cancelReason')
                .lean(),
            this.paymentModel
                .find({ clinicId, patientId, currency })
                .select('invoiceId amount date method voidedAt voidType voidReason appliedAt')
                .populate({ path: 'invoiceId', select: 'invoiceNumber' })
                .lean(),
        ]);

        type Raw = Omit<StatementLine, 'balance' | 'charge' | 'payment'> & { charge: number; payment: number };
        const raw: Raw[] = [];
        for (const i of invoices) {
            raw.push({ date: i.issuedAt, type: 'invoice', invoiceId: i._id, invoiceNumber: i.invoiceNumber, charge: i.totalAmount, payment: 0 });
            if (i.status === InvoiceStatus.CANCELLED && i.cancelledAt) {
                raw.push({
                    date: i.cancelledAt,
                    type: 'invoice_cancelled',
                    invoiceId: i._id,
                    invoiceNumber: i.invoiceNumber,
                    reason: i.cancelReason,
                    charge: -i.totalAmount,
                    payment: 0,
                });
            }
        }
        for (const p of payments) {
            const invoice = p.invoiceId as unknown as { _id: Id; invoiceNumber: string } | null;
            const common = {
                paymentId: p._id,
                invoiceId: invoice?._id,
                invoiceNumber: invoice?.invoiceNumber,
                method: p.method,
                onAccount: !invoice,
                fromCredit: !!p.appliedAt,
            };
            raw.push({ ...common, date: p.date, type: 'payment', charge: 0, payment: p.amount });
            if (p.voidedAt) {
                raw.push({ ...common, date: p.voidedAt, type: 'payment_voided', reason: p.voidReason, charge: 0, payment: -p.amount });
            }
        }
        // Same moment: the charge before the payment, so the running balance never dips below what is owed.
        const order = { invoice: 0, payment: 1, payment_voided: 2, invoice_cancelled: 3 };
        raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || order[a.type] - order[b.type]);

        let running = 0;
        const lines: StatementLine[] = raw.map((line) => {
            running += line.charge - line.payment;
            return {
                ...line,
                charge: toMajor(line.charge, currency),
                payment: toMajor(line.payment, currency),
                balance: toMajor(running, currency),
            };
        });
        return { currency, lines, balance: toMajor(running, currency) };
    }

    /**
     * One payment over several invoices. Each invoice is paid with the same
     * conditional update a single payment uses, so a balance that changed
     * meanwhile is never overpaid; if any part fails, the parts already
     * applied are taken back and nothing is recorded.
     */
    async takePayment(clinicId: Id, patientId: Id, userId: Id, dto: TakePaymentDto) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const { currency } = await this.clinicRefs.localeOf(clinicId);
        const total = toMinor(dto.amount, currency);
        if (dto.date && new Date(dto.date).getTime() > Date.now() + 24 * 3600 * 1000) {
            throw new BadRequestException(errorBody('paymentInFuture', 'A payment cannot be dated in the future'));
        }

        const open = await this.openInvoices(clinicId, patientId, currency);
        const plan = this.allocate(open, total, dto, currency);
        const applied: { invoiceId: Id; amount: number }[] = [];
        const undo = () =>
            Promise.all(
                applied.map((a) =>
                    this.invoiceModel.updateOne({ _id: a.invoiceId }, [
                        { $set: { paidAmount: { $subtract: ['$paidAmount', a.amount] } } },
                        STATUS_FROM_AMOUNTS,
                    ]),
                ),
            );

        for (const part of plan) {
            const ok = await this.invoiceModel.updateOne(
                {
                    _id: part.invoiceId,
                    clinicId,
                    patientId,
                    status: { $in: OPEN_STATUSES },
                    $expr: { $lte: [{ $add: ['$paidAmount', part.amount] }, '$totalAmount'] },
                },
                [{ $set: { paidAmount: { $add: ['$paidAmount', part.amount] } } }, STATUS_FROM_AMOUNTS],
            );
            if (!ok.modifiedCount) {
                await undo();
                throw new ConflictException(
                    errorBody('invoiceBalanceChanged', 'An invoice changed while the payment was being recorded; check and try again'),
                );
            }
            applied.push(part);
        }

        const receiptId = new Types.ObjectId();
        const onAccount = total - plan.reduce((s, p) => s + p.amount, 0);
        const base = {
            clinicId,
            patientId,
            currency,
            method: dto.method,
            date: dto.date ? new Date(dto.date) : new Date(),
            reference: dto.reference,
            notes: dto.notes,
            receivedBy: userId,
            receiptId,
        };
        let payments: { invoiceId?: Id; amount: number }[];
        try {
            payments = await this.paymentModel.insertMany([
                ...plan.map((p) => ({ ...base, invoiceId: p.invoiceId, amount: p.amount })),
                ...(onAccount > 0 ? [{ ...base, amount: onAccount }] : []),
            ]);
        } catch (err) {
            await undo();
            throw err;
        }

        const numbers = open.filter((i) => plan.some((p) => p.invoiceId.equals(i._id))).map((i) => i.invoiceNumber);
        await this.notifications.notify({
            clinicId,
            recipients: await this.notifications.staffWithRoles(clinicId, [Role.CLINIC_ADMIN]),
            actorId: userId,
            type: NotificationType.PAYMENT_RECEIVED,
            relatedId: patientId,
            relatedType: NotificationRelatedType.PATIENT,
            data: {
                patientName: personName(await this.patientRef(patientId)),
                invoiceNumber: numbers.join(', '),
                amount: toMajor(total, currency),
                currency,
                onAccount: toMajor(onAccount, currency),
            },
        });

        return {
            receiptId,
            paid: payments.filter((p) => p.invoiceId).map((p) => ({ invoiceId: p.invoiceId, amount: toMajor(p.amount, currency) })),
            credit: toMajor(onAccount, currency),
            account: await this.getAccount(clinicId, patientId),
        };
    }

    /**
     * Pay an open invoice from the patient's credit, oldest credit first.
     * Each piece is claimed from the credit and then added to the invoice,
     * both conditionally; if the invoice refuses, the piece goes back.
     */
    async applyCredit(clinicId: Id, invoiceId: Id, userId: Id, dto: ApplyCreditDto) {
        const invoice = await this.invoiceModel.findOne({ _id: invoiceId, clinicId }).lean();
        if (!invoice) throw new NotFoundException(errorBody('invoiceNotFound', 'Invoice not found'));
        if (!OPEN_STATUSES.includes(invoice.status)) {
            throw new BadRequestException(errorBody('invoiceNotOpen', 'Only an issued, unpaid invoice can take credit'));
        }
        const currency = invoice.currency as Currency;
        const credits = await this.credits(clinicId, invoice.patientId, currency);
        const available = credits.reduce((s, c) => s + c.amount, 0);
        const balance = invoice.totalAmount - invoice.paidAmount;
        const wanted = dto.amount !== undefined ? toMinor(dto.amount, currency) : Math.min(available, balance);
        if (available <= 0) throw new BadRequestException(errorBody('noCredit', 'The patient has no credit'));
        if (wanted > available) throw new BadRequestException(errorBody('creditInsufficient', 'More than the patient has in credit'));
        if (wanted > balance) throw new BadRequestException(errorBody('paymentExceedsBalance', 'More than the invoice balance'));

        let remaining = wanted;
        const now = new Date();
        for (const credit of credits) {
            if (remaining <= 0) break;
            const piece = Math.min(credit.amount, remaining);
            const whole = piece === credit.amount;
            // Claim the piece from the credit.
            const claimed = whole
                ? await this.paymentModel.updateOne(
                      { _id: credit._id, invoiceId: null, voidedAt: null, amount: piece },
                      { $set: { invoiceId, appliedAt: now, appliedBy: userId } },
                  )
                : await this.paymentModel.updateOne(
                      { _id: credit._id, invoiceId: null, voidedAt: null, amount: { $gt: piece } },
                      { $inc: { amount: -piece } },
                  );
            if (!claimed.modifiedCount) continue; // used meanwhile; try the next one
            let splitId: Id | undefined;
            if (!whole) {
                const split = await this.paymentModel.create({
                    clinicId,
                    patientId: credit.patientId,
                    invoiceId,
                    amount: piece,
                    currency,
                    method: credit.method,
                    date: credit.date,
                    reference: credit.reference,
                    receivedBy: credit.receivedBy,
                    receiptId: credit.receiptId,
                    appliedAt: now,
                    appliedBy: userId,
                    splitFrom: credit._id,
                });
                splitId = split._id;
            }
            // Add it to the invoice.
            const added = await this.invoiceModel.updateOne(
                {
                    _id: invoiceId,
                    clinicId,
                    status: { $in: OPEN_STATUSES },
                    $expr: { $lte: [{ $add: ['$paidAmount', piece] }, '$totalAmount'] },
                },
                [{ $set: { paidAmount: { $add: ['$paidAmount', piece] } } }, STATUS_FROM_AMOUNTS],
            );
            if (!added.modifiedCount) {
                if (whole) {
                    await this.paymentModel.updateOne({ _id: credit._id }, { $unset: { invoiceId: '', appliedAt: '', appliedBy: '' } });
                } else {
                    await this.paymentModel.deleteOne({ _id: splitId });
                    await this.paymentModel.updateOne({ _id: credit._id }, { $inc: { amount: piece } });
                }
                throw new ConflictException(errorBody('invoiceBalanceChanged', 'The invoice changed meanwhile; check and try again'));
            }
            remaining -= piece;
        }
        if (remaining === wanted) {
            throw new ConflictException(errorBody('creditChanged', "The patient's credit changed meanwhile; check and try again"));
        }
        return {
            applied: toMajor(wanted - remaining, currency),
            account: await this.getAccount(clinicId, invoice.patientId),
        };
    }

    /** Give money on account back to the patient (or void it as a mistake). Admins only. */
    async voidCredit(clinicId: Id, patientId: Id, paymentId: Id, userId: Id, dto: VoidPaymentDto) {
        const voided = await this.paymentModel.findOneAndUpdate(
            { _id: paymentId, clinicId, patientId, invoiceId: null, voidedAt: null },
            { $set: { voidedAt: new Date(), voidedBy: userId, voidType: dto.type, voidReason: dto.reason } },
            { new: true },
        );
        if (!voided) {
            const payment = await this.paymentModel.findOne({ _id: paymentId, clinicId, patientId }).lean();
            if (!payment) throw new NotFoundException(errorBody('paymentNotFound', 'Payment not found'));
            if (payment.voidedAt) throw new BadRequestException(errorBody('paymentAlreadyVoided', 'This payment was already voided'));
            throw new BadRequestException(errorBody('creditApplied', 'This money is already on an invoice; void it there'));
        }
        return this.getAccount(clinicId, patientId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Oldest first: that is the order money is applied in. */
    private openInvoices(clinicId: Id, patientId: Id, currency: Currency) {
        return this.invoiceModel
            .find({ clinicId, patientId, currency, status: { $in: OPEN_STATUSES } })
            .sort({ issuedAt: 1, _id: 1 })
            .select('invoiceNumber totalAmount paidAmount issuedAt dueDate status')
            .lean();
    }

    private credits(clinicId: Id, patientId: Id, currency: Currency) {
        return this.paymentModel
            .find({ clinicId, patientId, currency, invoiceId: null, voidedAt: null })
            .sort({ date: 1, _id: 1 })
            .populate({ path: 'receivedBy', select: PERSON })
            .lean();
    }

    private patientRef(patientId: Id) {
        return this.patientModel.findById(patientId).select(PERSON).lean();
    }

    /** How a payment is spread over the open invoices: as asked, or oldest first. Validated against today's balances. */
    private allocate(
        open: { _id: Id; totalAmount: number; paidAmount: number }[],
        total: number,
        dto: TakePaymentDto,
        currency: Currency,
    ): { invoiceId: Id; amount: number }[] {
        if (!dto.allocations) {
            const plan: { invoiceId: Id; amount: number }[] = [];
            let left = total;
            for (const invoice of open) {
                if (left <= 0) break;
                const amount = Math.min(left, invoice.totalAmount - invoice.paidAmount);
                if (amount > 0) plan.push({ invoiceId: invoice._id, amount });
                left -= amount;
            }
            return plan;
        }
        const seen = new Set<string>();
        const plan = dto.allocations.map((a) => {
            const invoice = open.find((i) => i._id.toString() === a.invoiceId);
            if (!invoice) throw new BadRequestException(errorBody('invoiceNotOpen', 'Only issued, unpaid invoices of this patient can be paid'));
            if (seen.has(a.invoiceId)) throw new BadRequestException(errorBody('validationFailed', 'An invoice appears twice'));
            seen.add(a.invoiceId);
            const amount = toMinor(a.amount, currency);
            if (amount > invoice.totalAmount - invoice.paidAmount) {
                throw new BadRequestException(errorBody('paymentExceedsBalance', 'More than an invoice balance'));
            }
            return { invoiceId: invoice._id, amount };
        });
        if (plan.reduce((s, p) => s + p.amount, 0) > total) {
            throw new BadRequestException(errorBody('allocationExceedsPayment', 'The parts add up to more than the payment'));
        }
        return plan;
    }
}
