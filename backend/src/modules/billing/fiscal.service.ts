import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { clinicDayRange, Currency, errorBody, toMajor } from 'src/common/utils';
import { Invoice, InvoiceDocument } from './invoice.schema';
import { Payment, PaymentDocument, PaymentVoidType } from './payment.schema';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { QueryFiscalReceiptsDto } from './dto/fiscal.dto';

type Id = Types.ObjectId;
const PERSON = 'firstName lastName patronymic';

/** The payments one fiscal receipt covers: a multi-invoice payment's parts share `receiptId`. */
const groupOf = (p: { _id: Id; receiptId?: Id | null }) => (p.receiptId ? { receiptId: p.receiptId } : { _id: p._id });

/**
 * F10, manual: the clinic prints fiscal receipts on its own cash register
 * (ՀԴՄ) and records each receipt's number against the payment here. One
 * number per receipt; the same number can't be recorded on another payment.
 */
@Injectable()
export class FiscalService {
    constructor(
        @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    /** Refuse a number already recorded on another receipt of the clinic. */
    async assertUnused(clinicId: Id, fiscalNumber: string, except?: Record<string, unknown>) {
        const taken = await this.paymentModel.exists({ clinicId, fiscalNumber, ...(except ? { $nor: [except] } : {}) });
        if (taken) {
            throw new ConflictException(errorBody('fiscalNumberUsed', 'This fiscal receipt number is already recorded on another payment'));
        }
    }

    /** Fields to store on new payments that come with a number. */
    stamp(fiscalNumber: string | null | undefined, userId: Id) {
        return fiscalNumber ? { fiscalNumber, fiscalRecordedAt: new Date(), fiscalRecordedBy: userId } : {};
    }

    /** Record, change or (with null) clear the number for the whole receipt the payment belongs to. */
    async setNumber(clinicId: Id, paymentId: Id, userId: Id, fiscalNumber: string | null) {
        const payment = await this.paymentModel.findOne({ _id: paymentId, clinicId }).select('receiptId').lean();
        if (!payment) throw new NotFoundException(errorBody('paymentNotFound', 'Payment not found'));
        const group = { clinicId, ...groupOf(payment) };
        if (fiscalNumber) await this.assertUnused(clinicId, fiscalNumber, groupOf(payment));
        await this.paymentModel.updateMany(
            group,
            fiscalNumber
                ? { $set: { fiscalNumber, fiscalRecordedAt: new Date(), fiscalRecordedBy: userId } }
                : { $unset: { fiscalNumber: '', fiscalRecordedAt: '', fiscalRecordedBy: '' } },
        );
        const [receipt] = await this.receipts(clinicId, { ...group }, 1);
        return receipt;
    }

    /**
     * Receipts (money received, grouped as the cash register would print it),
     * newest first, with or without a number. Payments voided as mistakes
     * never happened and are left out; refunded ones stay (the sale was real).
     */
    async list(clinicId: Id, query: QueryFiscalReceiptsDto) {
        const match: Record<string, unknown> = { clinicId, voidType: { $ne: PaymentVoidType.MISTAKE } };
        if (query.from || query.to) {
            const timezone = await this.clinicRefs.timezoneOf(clinicId);
            const date: Record<string, Date> = {};
            if (query.from) date.$gte = clinicDayRange(query.from, timezone).start;
            if (query.to) date.$lt = clinicDayRange(query.to, timezone).end;
            match.date = date;
        }
        const all = await this.receipts(clinicId, match, 2000);
        const status = query.status ?? 'missing';
        const items = all.filter((r) => (status === 'all' ? true : status === 'missing' ? !r.fiscalNumber : !!r.fiscalNumber));
        return {
            items: items.slice(0, query.limit ?? 100),
            counts: { missing: all.filter((r) => !r.fiscalNumber).length, recorded: all.filter((r) => r.fiscalNumber).length },
        };
    }

    private async receipts(clinicId: Id, match: Record<string, unknown>, limit: number) {
        const rows = await this.paymentModel.aggregate<{
            _id: Id;
            paymentIds: Id[];
            date: Date;
            amount: number;
            currency: Currency;
            method: string;
            patientId: Id;
            invoiceIds: (Id | null)[];
            fiscalNumber: string | null;
            fiscalRecordedAt: Date | null;
            refunded: boolean;
        }>([
            { $match: match },
            {
                $group: {
                    _id: { $ifNull: ['$receiptId', '$_id'] },
                    paymentIds: { $push: '$_id' },
                    date: { $min: '$date' },
                    amount: { $sum: '$amount' },
                    currency: { $first: '$currency' },
                    method: { $first: '$method' },
                    patientId: { $first: '$patientId' },
                    // A part with no invoice (money on account) must count as null, not vanish.
                    invoiceIds: { $addToSet: { $ifNull: ['$invoiceId', null] } },
                    fiscalNumber: { $max: '$fiscalNumber' },
                    fiscalRecordedAt: { $max: '$fiscalRecordedAt' },
                    refunded: { $max: { $eq: ['$voidType', PaymentVoidType.REFUND] } },
                },
            },
            { $sort: { date: -1, _id: -1 } },
            { $limit: limit },
        ]);

        const patientIds = Array.from(new Set(rows.map((r) => String(r.patientId)))).map((id) => new Types.ObjectId(id));
        const invoiceIds = rows.flatMap((r) => r.invoiceIds.filter((i): i is Id => !!i));
        const [patients, invoices] = await Promise.all([
            this.patientModel.find({ _id: { $in: patientIds }, clinicId }).select(PERSON).lean(),
            this.invoiceModel.find({ _id: { $in: invoiceIds }, clinicId }).select('invoiceNumber').lean(),
        ]);
        return rows.map((r) => ({
            receiptKey: r._id,
            paymentIds: r.paymentIds,
            date: r.date,
            amount: toMajor(r.amount, r.currency),
            currency: r.currency,
            method: r.method,
            patient: patients.find((p) => p._id.equals(r.patientId)) ?? null,
            invoices: invoices.filter((i) => r.invoiceIds.some((id) => id && i._id.equals(id))).map((i) => ({ _id: i._id, invoiceNumber: i.invoiceNumber })),
            onAccount: r.invoiceIds.some((id) => !id),
            fiscalNumber: r.fiscalNumber ?? null,
            fiscalRecordedAt: r.fiscalRecordedAt ?? null,
            refunded: r.refunded,
        }));
    }
}
