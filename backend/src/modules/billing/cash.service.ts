import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { clinicDayRange, clinicToday, Currency, errorBody, toClinicDateString, toMajor, toMinor } from 'src/common/utils';
import { Invoice, InvoiceDocument, OPEN_STATUSES } from './invoice.schema';
import { Payment, PaymentDocument, PaymentMethod, PaymentVoidType } from './payment.schema';
import { Patient, PatientDocument } from 'src/modules/patients/patient.schema';
import { CashClosure, CashClosureDocument } from './cash-closure.schema';
import { CashReportQueryDto, CloseDayDto, DebtorsQueryDto } from './dto/cash.dto';

type Id = Types.ObjectId;
const PERSON = 'firstName lastName';
const DAY_MS = 86_400_000;
const METHODS = Object.values(PaymentMethod);
const AGE_BUCKETS = [
    { key: '0_30', max: 30 },
    { key: '31_60', max: 60 },
    { key: '61_90', max: 90 },
    { key: '90_plus', max: Infinity },
] as const;

const idOf = (ref: unknown) => (ref && typeof ref === 'object' ? String((ref as { _id: unknown })._id) : ref ? String(ref) : '');
const nameOf = (ref: unknown) => {
    const p = ref as { firstName?: string; lastName?: string } | null;
    return [p?.lastName, p?.firstName].filter(Boolean).join(' ');
};

/**
 * F5: the day's money (a "Z-report") and who owes what.
 *
 * A day is the clinic's calendar day. Money received that day counts on it,
 * except payments later voided as mistakes (they never happened). Refunds
 * count on the day the money went back, under whoever gave it back.
 */
@Injectable()
export class CashService {
    constructor(
        @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        @InjectModel(CashClosure.name) private readonly closureModel: Model<CashClosureDocument>,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    async report(clinicId: Id, query: CashReportQueryDto) {
        const { timezone, currency } = await this.clinicRefs.localeOf(clinicId);
        const date = query.date ?? toClinicDateString(new Date(), timezone);
        const { start, end } = clinicDayRange(date, timezone);
        const major = (v: number) => toMajor(v, currency);

        const [received, refunds, closure] = await Promise.all([
            this.paymentModel
                .find({ clinicId, currency, date: { $gte: start, $lt: end }, voidType: { $ne: PaymentVoidType.MISTAKE } })
                .sort({ date: 1, _id: 1 })
                .populate([
                    { path: 'receivedBy', select: PERSON },
                    { path: 'patientId', select: `${PERSON} patronymic` },
                    { path: 'invoiceId', select: 'invoiceNumber' },
                ])
                .lean(),
            this.paymentModel
                .find({ clinicId, currency, voidType: PaymentVoidType.REFUND, voidedAt: { $gte: start, $lt: end } })
                .sort({ voidedAt: 1, _id: 1 })
                .populate([
                    { path: 'voidedBy', select: PERSON },
                    { path: 'patientId', select: `${PERSON} patronymic` },
                    { path: 'invoiceId', select: 'invoiceNumber' },
                ])
                .lean(),
            this.closureModel.findOne({ clinicId, date }).populate({ path: 'closedBy', select: PERSON }).lean(),
        ]);

        const byMethod = METHODS.map((method) => {
            const inn = received.filter((p) => p.method === method);
            const out = refunds.filter((p) => p.method === method);
            const r = inn.reduce((s, p) => s + p.amount, 0);
            const f = out.reduce((s, p) => s + p.amount, 0);
            return { method, received: r, refunded: f, net: r - f, count: inn.length };
        });

        const cashiers = new Map<string, { name: string; received: number; refunded: number; cash: number; count: number }>();
        const cashier = (ref: unknown) => {
            const key = idOf(ref);
            if (!cashiers.has(key)) cashiers.set(key, { name: nameOf(ref), received: 0, refunded: 0, cash: 0, count: 0 });
            return cashiers.get(key)!;
        };
        for (const p of received) {
            const c = cashier(p.receivedBy);
            c.received += p.amount;
            c.count += 1;
            if (p.method === PaymentMethod.CASH) c.cash += p.amount;
        }
        for (const p of refunds) {
            const c = cashier(p.voidedBy);
            c.refunded += p.amount;
            if (p.method === PaymentMethod.CASH) c.cash -= p.amount;
        }

        const totalIn = received.reduce((s, p) => s + p.amount, 0);
        const totalOut = refunds.reduce((s, p) => s + p.amount, 0);
        const cash = byMethod.find((m) => m.method === PaymentMethod.CASH)!;
        const expectedCash = cash.net;
        const line = (p: (typeof received)[number], by: unknown, at: Date) => ({
            _id: p._id,
            at,
            patient: p.patientId,
            invoiceId: idOf(p.invoiceId) || null,
            invoiceNumber: (p.invoiceId as unknown as { invoiceNumber?: string } | null)?.invoiceNumber ?? null,
            method: p.method,
            amount: major(p.amount),
            by: nameOf(by),
            refunded: p.voidType === PaymentVoidType.REFUND,
            fiscalNumber: p.fiscalNumber ?? null,
        });
        // F10: receipts of the day still without a fiscal number (parts of one payment count once).
        const receiptKeys = new Map<string, boolean>();
        for (const p of received) {
            const key = String(p.receiptId ?? p._id);
            receiptKeys.set(key, (receiptKeys.get(key) ?? false) || !!p.fiscalNumber);
        }
        const fiscalMissing = [...receiptKeys.values()].filter((has) => !has).length;

        return {
            date,
            currency,
            totals: {
                received: major(totalIn),
                refunded: major(totalOut),
                net: major(totalIn - totalOut),
                count: received.length,
                onAccount: major(received.filter((p) => !p.invoiceId).reduce((s, p) => s + p.amount, 0)),
                fiscalMissing,
            },
            expectedCash: major(expectedCash),
            byMethod: byMethod.map((m) => ({ ...m, received: major(m.received), refunded: major(m.refunded), net: major(m.net) })),
            byCashier: [...cashiers.values()]
                .sort((a, b) => b.received - a.received)
                .map((c) => ({ ...c, received: major(c.received), refunded: major(c.refunded), cash: major(c.cash) })),
            payments: received.map((p) => line(p, p.receivedBy, p.date)),
            refunds: refunds.map((p) => line(p, p.voidedBy, p.voidedAt!)),
            closure: closure
                ? {
                      countedCash: major(closure.countedCash),
                      expectedCash: major(closure.expectedCash),
                      difference: major(closure.difference),
                      note: closure.note,
                      closedBy: closure.closedBy,
                      closedAt: (closure as unknown as { createdAt: Date }).createdAt,
                      // Something dated this day was added or voided after it was closed.
                      changed:
                          closure.received !== totalIn || closure.refunded !== totalOut || closure.expectedCash !== expectedCash,
                  }
                : null,
        };
    }

    /** Count the drawer and close the day. The figures are kept as they were at this moment. */
    async close(clinicId: Id, userId: Id, dto: CloseDayDto) {
        const { timezone, currency } = await this.clinicRefs.localeOf(clinicId);
        if (dto.date > toClinicDateString(new Date(), timezone)) {
            throw new BadRequestException(errorBody('dayInFuture', 'A day can be closed only once it has started'));
        }
        const report = await this.report(clinicId, { date: dto.date });
        const minor = (v: number) => toMinor(v, currency);
        const counted = minor(dto.countedCash);
        try {
            await this.closureModel.create({
                clinicId,
                date: dto.date,
                currency,
                expectedCash: minor(report.expectedCash),
                countedCash: counted,
                difference: counted - minor(report.expectedCash),
                received: minor(report.totals.received),
                refunded: minor(report.totals.refunded),
                paymentCount: report.totals.count,
                note: dto.note,
                closedBy: userId,
            });
        } catch (err) {
            if ((err as { code?: number }).code === 11000) {
                throw new ConflictException(errorBody('dayAlreadyClosed', 'This day is already closed'));
            }
            throw err;
        }
        return this.report(clinicId, { date: dto.date });
    }

    /** Admin: undo a closing so the day can be counted again. */
    async reopen(clinicId: Id, date: string) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException(errorBody('validationFailed', 'date must be YYYY-MM-DD'));
        const removed = await this.closureModel.deleteOne({ clinicId, date });
        if (!removed.deletedCount) throw new NotFoundException(errorBody('dayNotClosed', 'This day is not closed'));
        return this.report(clinicId, { date });
    }

    /**
     * Patients who owe money: open invoices minus their credit. Age is
     * counted from the due date, or from the issue date when there is none;
     * "overdue" is only a due date that has passed (as on the invoice list).
     */
    async debtors(clinicId: Id, query: DebtorsQueryDto) {
        const { timezone, currency } = await this.clinicRefs.localeOf(clinicId);
        // Whole clinic calendar days, so "due 40 days ago" is 40 whatever the hour.
        const dayNumber = (d: Date) => Date.parse(`${toClinicDateString(d, timezone)}T00:00:00Z`) / DAY_MS;
        const todayNumber = dayNumber(new Date());
        const today = clinicToday(timezone).start.getTime();
        const major = (v: number) => toMajor(v, currency);

        const invoices = await this.invoiceModel
            .find({ clinicId, currency, status: { $in: OPEN_STATUSES } })
            .select('patientId totalAmount paidAmount issuedAt dueDate')
            .lean();
        type Row = { owed: number; invoices: number; oldest: number; overdue: boolean; maxAge: number; buckets: Record<string, number> };
        const rows = new Map<string, Row>();
        const totalsByBucket: Record<string, number> = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0]));
        for (const invoice of invoices) {
            const owed = invoice.totalAmount - invoice.paidAmount;
            if (owed <= 0) continue;
            const from = new Date(invoice.dueDate ?? invoice.issuedAt ?? today).getTime();
            const age = Math.max(0, todayNumber - dayNumber(new Date(from)));
            const bucket = AGE_BUCKETS.find((b) => age <= b.max)!.key;
            const key = String(invoice.patientId);
            const row = rows.get(key) ?? {
                owed: 0,
                invoices: 0,
                oldest: Infinity,
                overdue: false,
                maxAge: 0,
                buckets: Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0])),
            };
            row.owed += owed;
            row.invoices += 1;
            row.oldest = Math.min(row.oldest, from);
            row.maxAge = Math.max(row.maxAge, age);
            row.overdue ||= !!invoice.dueDate && new Date(invoice.dueDate).getTime() < today;
            row.buckets[bucket] += owed;
            rows.set(key, row);
        }

        const patientIds = [...rows.keys()].map((id) => new Types.ObjectId(id));
        const [credits, lastPayments, patients] = await Promise.all([
            this.paymentModel.aggregate<{ _id: Id; credit: number }>([
                { $match: { clinicId, currency, patientId: { $in: patientIds }, invoiceId: null, voidedAt: null } },
                { $group: { _id: '$patientId', credit: { $sum: '$amount' } } },
            ]),
            this.paymentModel.aggregate<{ _id: Id; last: Date }>([
                { $match: { clinicId, patientId: { $in: patientIds }, voidedAt: null } },
                { $group: { _id: '$patientId', last: { $max: '$date' } } },
            ]),
            this.patientModel.find({ _id: { $in: patientIds }, clinicId }).select(`${PERSON} patronymic phone status`).lean(),
        ]);
        const creditOf = new Map(credits.map((c) => [String(c._id), c.credit]));
        const lastOf = new Map(lastPayments.map((p) => [String(p._id), p.last]));
        const patientOf = new Map(patients.map((p) => [String(p._id), p]));
        const min = query.minAmount !== undefined ? toMinor(query.minAmount, currency) : 1;

        const list = [...rows.entries()]
            .map(([id, row]) => {
                const credit = creditOf.get(id) ?? 0;
                return { id, row, credit, net: row.owed - credit };
            })
            .filter(({ id, row, net }) => net >= min && patientOf.has(id) && (!query.overdueOnly || row.overdue))
            .sort((a, b) => (query.sort === 'age' ? a.row.oldest - b.row.oldest : b.net - a.net));

        for (const { row } of list) for (const b of AGE_BUCKETS) totalsByBucket[b.key] += row.buckets[b.key];

        return {
            currency,
            totals: {
                patients: list.length,
                owed: major(list.reduce((s, d) => s + d.row.owed, 0)),
                credit: major(list.reduce((s, d) => s + d.credit, 0)),
                net: major(list.reduce((s, d) => s + d.net, 0)),
                byAge: Object.fromEntries(Object.entries(totalsByBucket).map(([k, v]) => [k, major(v)])),
            },
            debtors: list.slice(0, 500).map(({ id, row, credit, net }) => ({
                patient: patientOf.get(id),
                owed: major(row.owed),
                credit: major(credit),
                net: major(net),
                invoices: row.invoices,
                oldestDate: new Date(row.oldest),
                daysOld: row.maxAge,
                overdue: row.overdue,
                lastPayment: lastOf.get(id) ?? null,
                byAge: Object.fromEntries(Object.entries(row.buckets).map(([k, v]) => [k, major(v)])),
            })),
        };
    }
}
