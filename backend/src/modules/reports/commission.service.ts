import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { Role } from 'src/common/decorators';
import { Currency, errorBody, toClinicDateString, toMajor } from 'src/common/utils';
import { User, UserDocument } from '../auth/auth.schema';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import { Invoice, InvoiceDocument } from '../billing/invoice.schema';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { CollectedLine, ReportsService, ReportViewer } from './reports.service';
import { CarriedFrom, CommissionRow, CommissionStatement, CommissionStatementDocument } from './commission-statement.schema';
import { SetCommissionRatesDto } from './dto/commission.dto';

type Id = Types.ObjectId;
const ADMINS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN];
/** How far back changes to approved months are looked for. */
const LOOKBACK_MONTHS = 24;

const lastDay = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
const shiftMonth = (month: string, by: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const commissionOf = (collected: number, rate: number) => Math.round((collected * rate) / 100);
const nameOf = (u?: { firstName?: string; lastName?: string } | null) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

/**
 * F11: dentist commission — a % (clinic default, or the dentist's own) of the
 * money collected for their work in a month, attributed exactly as the
 * dentist report does. A month is live until an admin approves it; then it
 * is frozen, and later changes to it (a refund, a voided payment) are settled
 * as an adjustment in the next month that gets approved.
 */
@Injectable()
export class CommissionService {
    constructor(
        @InjectModel(CommissionStatement.name) private readonly statementModel: Model<CommissionStatementDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        private readonly reports: ReportsService,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    // ── Rates ────────────────────────────────────────────────────────────────

    async rates(clinicId: Id) {
        const [clinic, dentists] = await Promise.all([
            this.clinicModel.findById(clinicId).select('commissionRate').lean(),
            this.userModel
                .find({ clinicId, $or: [{ role: Role.DENTIST, isActive: true }, { commissionRate: { $ne: null } }] })
                .select('firstName lastName isActive commissionRate role')
                .sort({ lastName: 1, firstName: 1 })
                .lean(),
        ]);
        return {
            defaultRate: clinic?.commissionRate ?? 0,
            dentists: dentists.map((d) => ({
                dentistId: d._id,
                firstName: d.firstName,
                lastName: d.lastName,
                isActive: d.isActive,
                rate: d.commissionRate ?? null,
            })),
        };
    }

    async setRates(clinicId: Id, dto: SetCommissionRatesDto) {
        if (dto.defaultRate !== undefined) {
            await this.clinicModel.updateOne({ _id: clinicId }, { $set: { commissionRate: dto.defaultRate } });
        }
        for (const d of dto.dentists ?? []) {
            const dentistId = new Types.ObjectId(d.dentistId);
            const exists = await this.userModel.exists({ _id: dentistId, clinicId, role: Role.DENTIST });
            if (!exists) throw new NotFoundException(errorBody('staffNotFound', 'No such dentist in this clinic'));
            await this.userModel.updateOne(
                { _id: dentistId, clinicId },
                d.rate === null ? { $unset: { commissionRate: '' } } : { $set: { commissionRate: d.rate } },
            );
        }
        return this.rates(clinicId);
    }

    // ── Statement ────────────────────────────────────────────────────────────

    /** A month: approved (frozen) or live. Admins see every dentist; a dentist only their own. */
    async statement(viewer: ReportViewer, month: string) {
        const clinicId = viewer.clinicId;
        const current = await this.currentMonth(clinicId);
        if (month > current) throw new BadRequestException(errorBody('commissionMonthFuture', 'That month has not started yet'));

        const approved = await this.statementModel.findOne({ clinicId, month }).populate({ path: 'approvedBy', select: 'firstName lastName' }).lean();
        const live = await this.live(clinicId, month);
        const currency = (approved?.currency as Currency) ?? live.currency;
        const major = (v: number) => toMajor(v, currency);

        let rows: (CommissionRow & { liveCollected?: number; changedSince?: number })[];
        if (approved) {
            rows = approved.rows.map((r) => {
                const liveCollected = Math.round(live.byDentist.get(String(r.dentistId)) ?? 0);
                return { ...r, liveCollected, changedSince: commissionOf(liveCollected, r.rate) - (r.commission + (r.carried ?? 0)) };
            });
        } else {
            rows = (await this.computeRows(clinicId, month, live)).rows;
        }

        const own = !ADMINS.includes(viewer.role);
        if (own) rows = rows.filter((r) => r.dentistId.equals(viewer.userId));
        const rateOf = new Map(rows.map((r) => [String(r.dentistId), r.rate]));
        const lines = await this.describe(clinicId, live.lines.filter((l) => l.dentistId && rateOf.has(l.dentistId)), rateOf);

        const sum = (k: 'collected' | 'commission' | 'adjustment') => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
        const ended = month < current;
        return {
            month,
            currency,
            status: approved ? 'approved' : 'live',
            approvedAt: approved?.approvedAt ?? null,
            approvedBy: approved ? nameOf(approved.approvedBy as unknown as { firstName?: string; lastName?: string }) : null,
            ownOnly: own,
            canApprove: !own && !approved && ended,
            canReopen: !own && !!approved,
            ended,
            rows: rows.map((r) => ({
                dentistId: r.dentistId,
                name: r.name,
                collected: major(r.collected),
                rate: r.rate,
                commission: major(r.commission),
                adjustment: major(r.adjustment ?? 0),
                total: major(r.commission + (r.adjustment ?? 0)),
                // Approved months: what has changed since (settled in the next approval).
                ...(approved ? { changedSince: major(r.changedSince ?? 0) } : {}),
            })),
            totals: {
                collected: major(sum('collected')),
                commission: major(sum('commission')),
                adjustment: major(sum('adjustment')),
                total: major(sum('commission') + sum('adjustment')),
            },
            ...(own ? {} : { unassigned: major(Math.round(live.unassigned)) }),
            lines: lines.map((l) => ({ ...l, collected: major(l.collected), commission: major(l.commission) })),
        };
    }

    /** Freeze an ended month, settling changes to earlier approved months in it. */
    async approve(clinicId: Id, month: string, userId: Id) {
        if (month >= (await this.currentMonth(clinicId))) {
            throw new BadRequestException(errorBody('commissionMonthOpen', 'A month can be approved once it has ended'));
        }
        const live = await this.live(clinicId, month);
        const { rows, carriedFrom } = await this.computeRows(clinicId, month, live);
        try {
            await this.statementModel.create({ clinicId, month, currency: live.currency, rows, carriedFrom, approvedBy: userId, approvedAt: new Date() });
        } catch (err) {
            if ((err as { code?: number }).code === 11000) {
                throw new ConflictException(errorBody('commissionApproved', 'This month is already approved'));
            }
            throw err;
        }
        await this.applyCarried(clinicId, carriedFrom, 1);
        return { approved: true };
    }

    /** Undo an approval (latest approved month only); what it settled goes back to the earlier months. */
    async reopen(clinicId: Id, month: string) {
        const statement = await this.statementModel.findOne({ clinicId, month }).lean();
        if (!statement) throw new NotFoundException(errorBody('commissionNotApproved', 'This month is not approved'));
        if (await this.statementModel.exists({ clinicId, month: { $gt: month } })) {
            throw new ConflictException(errorBody('commissionLaterApproved', 'Reopen the later approved months first'));
        }
        await this.statementModel.deleteOne({ _id: statement._id });
        await this.applyCarried(clinicId, statement.carriedFrom, -1);
        return { reopened: true };
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private async currentMonth(clinicId: Id) {
        return toClinicDateString(new Date(), await this.clinicRefs.timezoneOf(clinicId)).slice(0, 7);
    }

    /** Collected money of the month, per dentist (minor units, unrounded) and per line. */
    private async live(clinicId: Id, month: string) {
        const { currency, lines } = await this.reports.attributedCollected(clinicId, `${month}-01`, lastDay(month));
        const byDentist = new Map<string, number>();
        let unassigned = 0;
        for (const l of lines) {
            if (l.dentistId) byDentist.set(l.dentistId, (byDentist.get(l.dentistId) ?? 0) + l.amount);
            else unassigned += l.amount;
        }
        return { currency, lines, byDentist, unassigned };
    }

    /** Rows for an unapproved month: current rates, plus what earlier approved months owe or are owed. */
    private async computeRows(clinicId: Id, month: string, live: Awaited<ReturnType<CommissionService['live']>>) {
        const [clinic, pending] = await Promise.all([
            this.clinicModel.findById(clinicId).select('commissionRate').lean(),
            this.pendingAdjustments(clinicId, month),
        ]);
        const ids = new Set<string>([...live.byDentist.keys(), ...pending.byDentist.keys()]);
        const dentists = await this.userModel
            .find({ clinicId, $or: [{ role: Role.DENTIST, isActive: true }, { _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) } }] })
            .select('firstName lastName commissionRate')
            .sort({ lastName: 1, firstName: 1 })
            .lean();
        const rows: CommissionRow[] = dentists.map((d) => {
            const collected = Math.round(live.byDentist.get(String(d._id)) ?? 0);
            const rate = d.commissionRate ?? clinic?.commissionRate ?? 0;
            return {
                dentistId: d._id,
                name: nameOf(d),
                collected,
                rate,
                commission: commissionOf(collected, rate),
                adjustment: pending.byDentist.get(String(d._id)) ?? 0,
                carried: 0,
            };
        });
        rows.sort((a, b) => b.collected - a.collected || a.name.localeCompare(b.name));
        return { rows, carriedFrom: pending.carriedFrom };
    }

    /**
     * Approved months before `month` whose money has changed since (refunds,
     * voids): the difference, per dentist, not yet settled in a later month.
     */
    private async pendingAdjustments(clinicId: Id, month: string) {
        const earlier = await this.statementModel
            .find({ clinicId, month: { $lt: month, $gte: shiftMonth(month, -LOOKBACK_MONTHS) } })
            .sort({ month: 1 })
            .lean();
        const byDentist = new Map<string, number>();
        const carriedFrom: CarriedFrom[] = [];
        for (const s of earlier) {
            const live = await this.live(clinicId, s.month);
            for (const r of s.rows) {
                const now = commissionOf(Math.round(live.byDentist.get(String(r.dentistId)) ?? 0), r.rate);
                const delta = now - (r.commission + (r.carried ?? 0));
                if (!delta) continue;
                byDentist.set(String(r.dentistId), (byDentist.get(String(r.dentistId)) ?? 0) + delta);
                carriedFrom.push({ month: s.month, dentistId: r.dentistId, delta });
            }
        }
        return { byDentist, carriedFrom };
    }

    private async applyCarried(clinicId: Id, carriedFrom: CarriedFrom[], sign: 1 | -1) {
        for (const c of carriedFrom) {
            await this.statementModel.updateOne(
                { clinicId, month: c.month },
                { $inc: { 'rows.$[row].carried': sign * c.delta } },
                { arrayFilters: [{ 'row.dentistId': c.dentistId }] },
            );
        }
    }

    /** The money behind each row: per dentist, invoice and line, with the patient. */
    private async describe(clinicId: Id, lines: CollectedLine[], rateOf: Map<string, number>) {
        const grouped = new Map<string, { dentistId: string; invoiceId?: string; description: string; collected: number }>();
        for (const l of lines) {
            const key = `${l.dentistId}|${l.invoiceId ?? ''}|${l.description}`;
            const g = grouped.get(key) ?? { dentistId: l.dentistId!, invoiceId: l.invoiceId, description: l.description, collected: 0 };
            g.collected += l.amount;
            grouped.set(key, g);
        }
        const invoiceIds = [...new Set([...grouped.values()].map((g) => g.invoiceId).filter(Boolean))].map((id) => new Types.ObjectId(id));
        const invoices = await this.invoiceModel.find({ _id: { $in: invoiceIds }, clinicId }).select('invoiceNumber patientId issuedAt').lean();
        const patients = await this.patientModel
            .find({ _id: { $in: invoices.map((i) => i.patientId) }, clinicId })
            .select('firstName lastName')
            .lean();
        return [...grouped.values()]
            .map((g) => {
                const invoice = invoices.find((i) => String(i._id) === g.invoiceId);
                const patient = invoice ? patients.find((p) => p._id.equals(invoice.patientId)) : undefined;
                const collected = Math.round(g.collected);
                return {
                    dentistId: g.dentistId,
                    invoiceId: g.invoiceId ?? null,
                    invoiceNumber: invoice?.invoiceNumber ?? null,
                    patient: patient ? nameOf(patient) : null,
                    description: g.description,
                    collected,
                    commission: commissionOf(collected, rateOf.get(g.dentistId) ?? 0),
                };
            })
            .filter((l) => l.collected !== 0)
            .sort((a, b) => (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? ''));
    }
}
