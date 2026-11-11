import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { ClinicRefsService } from 'src/common/clinic-refs';
import {
    clinicDateSpan,
    clinicMonth,
    clinicToday,
    Currency,
    errorBody,
    toClinicDateString,
    toMajor,
} from 'src/common/utils';
import { User, UserDocument } from '../auth/auth.schema';
import { Patient, PatientDocument, PatientStatus } from '../patients/patient.schema';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../appointments/appointment.schema';
import { Invoice, InvoiceDocument, InvoiceStatus, OPEN_STATUSES } from '../billing/invoice.schema';
import { Payment, PaymentDocument } from '../billing/payment.schema';
import { Treatment, TreatmentDocument } from '../treatments/treatment.schema';
import {
    TreatmentEntry,
    TreatmentEntryDocument,
    TreatmentEntryStatus,
} from '../dental-records/treatment-entry.schema';
import { ReportQueryDto } from './dto';
import { daysBetween, periodStarts, ReportGroupBy } from './report-periods';

export interface ReportViewer {
    clinicId: Types.ObjectId;
    userId: Types.ObjectId;
    role: Role;
}

/** Revenue (D5): admins only. Dentists see their own performance without money. */
export const REVENUE_ROLES = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN];
const BILLING_VIEWER_ROLES = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.RECEPTIONIST, Role.DENTIST];

const seesRevenue = (role: Role) => REVENUE_ROLES.includes(role);
const seesBilling = (role: Role) => BILLING_VIEWER_ROLES.includes(role);

const MAX_RANGE_DAYS = 3660;
const MAX_PERIODS = 400;
const ACTIVITY_PER_SOURCE = 6;
const ACTIVITY_LIMIT = 8;

const S = AppointmentStatus;
const BILLED_STATUSES = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.PAID];

interface ResolvedRange {
    startDate: string;
    endDate: string;
    start: Date;
    end: Date;
    groupBy: ReportGroupBy;
    timezone: string;
    currency: Currency;
}

/** A share of collected money, attributed to one invoice line. Amount in minor units, unrounded. */
interface CollectedLine {
    dentistId?: string;
    treatmentId?: string;
    description: string;
    amount: number;
}

const idOf = (v: unknown): string | undefined => (v ? String(v) : undefined);
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const statusCount = (status: AppointmentStatus) => ({ $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } });

/**
 * One revenue definition for every report and the dashboard: **collected** =
 * payments received in the period, not voided, in the clinic's currency (D3).
 * Per-dentist and per-treatment revenue split those same payments over the
 * invoice lines they paid for, so the parts add up to the total.
 * Amounts are stored in minor units (D2) and returned in major units.
 */
@Injectable()
export class ReportsService {
    constructor(
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(Treatment.name) private readonly treatmentModel: Model<TreatmentDocument>,
        @InjectModel(TreatmentEntry.name) private readonly entryModel: Model<TreatmentEntryDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    // ── Range ────────────────────────────────────────────────────────────────

    /** Clinic-day range, both ends included, as `[start, end)` instants in the clinic's timezone. */
    private async range(clinicId: Types.ObjectId, query: ReportQueryDto): Promise<ResolvedRange> {
        const { timezone, currency } = await this.clinicRefs.localeOf(clinicId);
        const endDate = query.endDate ?? toClinicDateString(new Date(), timezone);
        const startDate = query.startDate ?? `${endDate.slice(0, 7)}-01`;
        const groupBy = query.groupBy ?? 'day';

        if (startDate > endDate) {
            throw new BadRequestException(errorBody('invalidDateRange', 'startDate must not be after endDate'));
        }
        if (
            daysBetween(startDate, endDate) > MAX_RANGE_DAYS ||
            periodStarts(startDate, endDate, groupBy, MAX_PERIODS).length > MAX_PERIODS
        ) {
            throw new BadRequestException(
                errorBody('reportRangeTooLong', `At most ${MAX_PERIODS} ${groupBy}s and 10 years per report`),
            );
        }

        const span = clinicDateSpan(startDate, endDate, timezone);
        return { startDate, endDate, start: span.start!, end: span.end!, groupBy, timezone, currency };
    }

    private rangeOut(r: ResolvedRange) {
        return { startDate: r.startDate, endDate: r.endDate, timezone: r.timezone };
    }

    /** Payments that count as collected: received in `[start, end)`, not voided, in the clinic currency. */
    private collectedMatch(clinicId: Types.ObjectId, currency: Currency, start: Date, end: Date) {
        return { clinicId, currency, voidedAt: null, date: { $gte: start, $lt: end } };
    }

    private async collectedTotal(clinicId: Types.ObjectId, currency: Currency, start: Date, end: Date) {
        const [row] = await this.paymentModel.aggregate([
            { $match: this.collectedMatch(clinicId, currency, start, end) },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        return { total: row?.total ?? 0, count: row?.count ?? 0 };
    }

    /**
     * Collected money split over the lines of the invoices it paid, in
     * proportion to each line's total. A line's dentist is the one who did its
     * treatment entry, else the invoice appointment's dentist, else nobody.
     */
    private async collectedByLine(r: ResolvedRange, clinicId: Types.ObjectId): Promise<CollectedLine[]> {
        const perInvoice: { _id: Types.ObjectId; paid: number }[] = await this.paymentModel.aggregate([
            { $match: this.collectedMatch(clinicId, r.currency, r.start, r.end) },
            { $group: { _id: '$invoiceId', paid: { $sum: '$amount' } } },
        ]);
        if (!perInvoice.length) return [];

        const invoices = await this.invoiceModel
            .find({ _id: { $in: perInvoice.map((p) => p._id) }, clinicId })
            .select('items appointmentId')
            .lean();
        const entryIds = invoices.flatMap((i) => (i.items ?? []).map((it) => it.treatmentEntryId).filter(Boolean));
        const appointmentIds = invoices.map((i) => i.appointmentId).filter(Boolean);
        const [entries, appointments] = await Promise.all([
            this.entryModel.find({ _id: { $in: entryIds }, clinicId }).select('dentistId treatmentId').lean(),
            this.appointmentModel.find({ _id: { $in: appointmentIds }, clinicId }).select('dentistId').lean(),
        ]);
        const entryById = new Map(entries.map((e) => [String(e._id), e]));
        const dentistOfAppointment = new Map(appointments.map((a) => [String(a._id), idOf(a.dentistId)]));
        const paidOf = new Map(perInvoice.map((p) => [String(p._id), p.paid]));

        const lines: CollectedLine[] = [];
        for (const invoice of invoices) {
            const paid = paidOf.get(String(invoice._id)) ?? 0;
            const invoiceDentist = invoice.appointmentId
                ? dentistOfAppointment.get(String(invoice.appointmentId))
                : undefined;
            const items = invoice.items ?? [];
            const base = items.reduce((sum, it) => sum + (it.total || 0), 0);
            if (base <= 0) {
                lines.push({ dentistId: invoiceDentist, description: '', amount: paid });
                continue;
            }
            for (const item of items) {
                const entry = item.treatmentEntryId ? entryById.get(String(item.treatmentEntryId)) : undefined;
                lines.push({
                    dentistId: idOf(entry?.dentistId) ?? invoiceDentist,
                    treatmentId: idOf(item.treatmentId) ?? idOf(entry?.treatmentId),
                    description: item.description ?? '',
                    amount: (paid * (item.total || 0)) / base,
                });
            }
        }
        return lines;
    }

    // ── Revenue ──────────────────────────────────────────────────────────────

    /** Admin only. Collected per period and per method, invoiced, outstanding now. Never sums currencies. */
    async getRevenue(clinicId: Types.ObjectId, query: ReportQueryDto) {
        const r = await this.range(clinicId, query);
        const major = (v: number) => toMajor(v, r.currency);
        const collected = this.collectedMatch(clinicId, r.currency, r.start, r.end);
        const todayStart = clinicToday(r.timezone).start;
        const balance = { $subtract: ['$totalAmount', '$paidAmount'] };
        const isOverdue = { $lt: [{ $ifNull: ['$dueDate', todayStart] }, todayStart] };

        const [byPeriod, byMethod, otherCurrencies, invoiced, open] = await Promise.all([
            this.paymentModel.aggregate([
                { $match: collected },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: {
                                    $dateTrunc: {
                                        date: '$date',
                                        unit: r.groupBy,
                                        timezone: r.timezone,
                                        startOfWeek: 'monday',
                                    },
                                },
                                timezone: r.timezone,
                            },
                        },
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            this.paymentModel.aggregate([
                { $match: collected },
                { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { total: -1 } },
            ]),
            // Legacy payments in another currency (before D3): listed apart, never added in.
            this.paymentModel.aggregate([
                { $match: { ...collected, currency: { $ne: r.currency } } },
                { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            this.invoiceModel.aggregate([
                {
                    $match: {
                        clinicId,
                        currency: r.currency,
                        status: { $in: BILLED_STATUSES },
                        issuedAt: { $gte: r.start, $lt: r.end },
                    },
                },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            this.invoiceModel.aggregate([
                { $match: { clinicId, currency: r.currency, status: { $in: OPEN_STATUSES } } },
                {
                    $group: {
                        _id: null,
                        balance: { $sum: balance },
                        count: { $sum: 1 },
                        overdue: { $sum: { $cond: [isOverdue, balance, 0] } },
                        overdueCount: { $sum: { $cond: [isOverdue, 1, 0] } },
                    },
                },
            ]),
        ]);

        const periodTotals = new Map<string, { total: number; count: number }>(
            byPeriod.map((p) => [p._id, { total: p.total, count: p.count }]),
        );
        const totalMinor = byPeriod.reduce((sum, p) => sum + p.total, 0);

        return {
            ...this.rangeOut(r),
            groupBy: r.groupBy,
            currency: r.currency,
            collected: major(totalMinor),
            paymentCount: byPeriod.reduce((sum, p) => sum + p.count, 0),
            invoiced: major(invoiced[0]?.total ?? 0),
            invoiceCount: invoiced[0]?.count ?? 0,
            outstanding: {
                balance: major(open[0]?.balance ?? 0),
                invoices: open[0]?.count ?? 0,
                overdue: major(open[0]?.overdue ?? 0),
                overdueInvoices: open[0]?.overdueCount ?? 0,
            },
            byPeriod: periodStarts(r.startDate, r.endDate, r.groupBy).map((period) => ({
                period,
                total: major(periodTotals.get(period)?.total ?? 0),
                count: periodTotals.get(period)?.count ?? 0,
            })),
            byMethod: byMethod.map((m) => ({ method: m._id, total: major(m.total), count: m.count })),
            otherCurrencies: otherCurrencies.map((c) => ({
                currency: c._id,
                total: toMajor(c.total, c._id),
                count: c.count,
            })),
        };
    }

    // ── Appointments ─────────────────────────────────────────────────────────

    /**
     * Appointments starting in the range, by status. Rates are over the
     * appointments that reached an outcome (completed, cancelled, no-show), so
     * future bookings in the range don't pull the completion rate down.
     * Dentists see their own.
     */
    async getAppointmentStats(viewer: ReportViewer, query: ReportQueryDto) {
        const r = await this.range(viewer.clinicId, query);
        const rows: { _id: AppointmentStatus; count: number }[] = await this.appointmentModel.aggregate([
            {
                $match: {
                    clinicId: viewer.clinicId,
                    startTime: { $gte: r.start, $lt: r.end },
                    ...(viewer.role === Role.DENTIST ? { dentistId: viewer.userId } : {}),
                },
            },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const byStatus = Object.fromEntries(Object.values(S).map((s) => [s, 0])) as Record<AppointmentStatus, number>;
        for (const row of rows) byStatus[row._id] = row.count;
        const total = rows.reduce((sum, row) => sum + row.count, 0);
        const closed = byStatus[S.COMPLETED] + byStatus[S.CANCELLED] + byStatus[S.NO_SHOW];

        return {
            ...this.rangeOut(r),
            ownOnly: viewer.role === Role.DENTIST,
            total,
            byStatus,
            completed: byStatus[S.COMPLETED],
            cancelled: byStatus[S.CANCELLED],
            noShow: byStatus[S.NO_SHOW],
            completionRate: percent(byStatus[S.COMPLETED], closed),
            cancellationRate: percent(byStatus[S.CANCELLED], closed),
            noShowRate: percent(byStatus[S.NO_SHOW], closed),
        };
    }

    // ── Dentists ─────────────────────────────────────────────────────────────

    /**
     * Per dentist: appointments and outcomes, treatments done and (admins
     * only) collected revenue. Admins see every active dentist, plus former
     * ones with activity in the range; a dentist sees their own row.
     */
    async getDentistPerformance(viewer: ReportViewer, query: ReportQueryDto) {
        const r = await this.range(viewer.clinicId, query);
        const clinicId = viewer.clinicId;
        const own = viewer.role === Role.DENTIST ? { dentistId: viewer.userId } : {};
        const withRevenue = seesRevenue(viewer.role);

        const [appointments, treatments, lines] = await Promise.all([
            this.appointmentModel.aggregate([
                { $match: { clinicId, startTime: { $gte: r.start, $lt: r.end }, ...own } },
                {
                    $group: {
                        _id: '$dentistId',
                        appointments: { $sum: 1 },
                        completed: statusCount(S.COMPLETED),
                        cancelled: statusCount(S.CANCELLED),
                        noShow: statusCount(S.NO_SHOW),
                    },
                },
            ]),
            this.entryModel.aggregate([
                {
                    $match: {
                        clinicId,
                        status: TreatmentEntryStatus.DONE,
                        voidedAt: null,
                        date: { $gte: r.start, $lt: r.end },
                        ...own,
                    },
                },
                { $group: { _id: '$dentistId', count: { $sum: 1 } } },
            ]),
            withRevenue ? this.collectedByLine(r, clinicId) : Promise.resolve([] as CollectedLine[]),
        ]);

        const collected = new Map<string, number>();
        let unassigned = 0;
        for (const line of lines) {
            if (line.dentistId) collected.set(line.dentistId, (collected.get(line.dentistId) ?? 0) + line.amount);
            else unassigned += line.amount;
        }

        const activeIds = [...appointments.map((a) => a._id), ...treatments.map((t) => t._id), ...collected.keys()]
            .filter(Boolean)
            .map((id) => new Types.ObjectId(String(id)));
        const dentists = await this.userModel
            .find(
                viewer.role === Role.DENTIST
                    ? { _id: viewer.userId, clinicId }
                    : { clinicId, $or: [{ role: Role.DENTIST, isActive: true }, { _id: { $in: activeIds } }] },
            )
            .select('firstName lastName isActive')
            .lean();

        const apptOf = new Map(appointments.map((a) => [String(a._id), a]));
        const doneOf = new Map(treatments.map((t) => [String(t._id), t.count as number]));
        const money = (minor: number) => toMajor(Math.round(minor), r.currency);

        const rows = dentists.map((d) => {
            const id = String(d._id);
            const a = apptOf.get(id);
            return {
                dentistId: id,
                firstName: d.firstName,
                lastName: d.lastName,
                isActive: d.isActive,
                appointments: a?.appointments ?? 0,
                completed: a?.completed ?? 0,
                cancelled: a?.cancelled ?? 0,
                noShow: a?.noShow ?? 0,
                treatmentsDone: doneOf.get(id) ?? 0,
                ...(withRevenue ? { collected: money(collected.get(id) ?? 0) } : {}),
            };
        });
        rows.sort((x, y) => (y.collected ?? 0) - (x.collected ?? 0) || y.appointments - x.appointments);

        return {
            ...this.rangeOut(r),
            ownOnly: viewer.role === Role.DENTIST,
            ...(withRevenue ? { currency: r.currency, unassignedCollected: money(unassigned) } : {}),
            rows,
        };
    }

    // ── Treatments ───────────────────────────────────────────────────────────

    /**
     * Treatments done in the range (chart entries, not voided) and, for
     * admins, what was collected for them. Entries and invoice lines without a
     * catalogue item are grouped by their name. Dentists see their own.
     */
    async getTreatmentStats(viewer: ReportViewer, query: ReportQueryDto) {
        const r = await this.range(viewer.clinicId, query);
        const clinicId = viewer.clinicId;
        const withRevenue = seesRevenue(viewer.role);

        const [done, lines] = await Promise.all([
            this.entryModel.aggregate([
                {
                    $match: {
                        clinicId,
                        status: TreatmentEntryStatus.DONE,
                        voidedAt: null,
                        date: { $gte: r.start, $lt: r.end },
                        ...(viewer.role === Role.DENTIST ? { dentistId: viewer.userId } : {}),
                    },
                },
                {
                    $group: {
                        _id: {
                            treatmentId: '$treatmentId',
                            name: { $cond: [{ $ifNull: ['$treatmentId', false] }, null, '$treatmentName'] },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
            withRevenue ? this.collectedByLine(r, clinicId) : Promise.resolve([] as CollectedLine[]),
        ]);

        type Row = { treatmentId?: string; name: string; done: number; collected: number };
        const rows = new Map<string, Row>();
        const rowFor = (treatmentId: string | undefined, name: string) => {
            const key = treatmentId ? `t:${treatmentId}` : `n:${name.trim().toLowerCase()}`;
            let row = rows.get(key);
            if (!row) {
                row = { treatmentId, name, done: 0, collected: 0 };
                rows.set(key, row);
            }
            return row;
        };
        for (const d of done) rowFor(idOf(d._id.treatmentId), d._id.name ?? '').done += d.count;
        for (const line of lines) rowFor(line.treatmentId, line.description).collected += line.amount;

        const catalogue = await this.treatmentModel
            .find({ _id: { $in: [...rows.values()].map((row) => row.treatmentId).filter(Boolean) }, clinicId })
            .select('name nameHy nameRu code category')
            .lean();
        const byId = new Map(catalogue.map((t) => [String(t._id), t]));

        const out = [...rows.values()]
            .map((row) => {
                const t = row.treatmentId ? byId.get(row.treatmentId) : undefined;
                return {
                    treatmentId: row.treatmentId,
                    name: t?.name ?? row.name,
                    nameHy: t?.nameHy,
                    nameRu: t?.nameRu,
                    code: t?.code,
                    category: t?.category,
                    done: row.done,
                    ...(withRevenue ? { collected: toMajor(Math.round(row.collected), r.currency) } : {}),
                };
            })
            .sort((x, y) => (y.collected ?? 0) - (x.collected ?? 0) || y.done - x.done)
            .slice(0, 50);

        return {
            ...this.rangeOut(r),
            ownOnly: viewer.role === Role.DENTIST,
            ...(withRevenue ? { currency: r.currency } : {}),
            rows: out,
        };
    }

    // ── Patients ─────────────────────────────────────────────────────────────

    /** Clinic-wide counts now, and patients registered in the range. */
    async getPatientStats(clinicId: Types.ObjectId, query: ReportQueryDto) {
        const r = await this.range(clinicId, query);
        const [byStatus, newInRange, byGender] = await Promise.all([
            this.patientModel.aggregate([{ $match: { clinicId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
            this.patientModel.countDocuments({ clinicId, createdAt: { $gte: r.start, $lt: r.end } }),
            this.patientModel.aggregate([
                { $match: { clinicId, createdAt: { $gte: r.start, $lt: r.end } } },
                { $group: { _id: '$gender', count: { $sum: 1 } } },
            ]),
        ]);
        return {
            ...this.rangeOut(r),
            total: byStatus.reduce((sum, s) => sum + s.count, 0),
            active: byStatus.find((s) => s._id === PatientStatus.ACTIVE)?.count ?? 0,
            newInRange,
            newByGender: Object.fromEntries(byGender.map((g) => [g._id ?? 'unknown', g.count])),
        };
    }

    // ── Dashboard ────────────────────────────────────────────────────────────

    /**
     * Every role's landing page, so every role may load it; each part is
     * shown only to the roles allowed to see it elsewhere. Dentists get their
     * own appointments.
     */
    async getDashboard(viewer: ReportViewer) {
        const { clinicId, role } = viewer;
        const { timezone, currency } = await this.clinicRefs.localeOf(clinicId);
        const today = clinicToday(timezone);
        const month = clinicMonth(timezone);
        const now = new Date();
        const own: FilterQuery<AppointmentDocument> = role === Role.DENTIST ? { dentistId: viewer.userId } : {};
        const balance = { $subtract: ['$totalAmount', '$paidAmount'] };
        const isOverdue = { $lt: [{ $ifNull: ['$dueDate', today.start] }, today.start] };

        const [todayByStatus, upcoming, activePatients, newPatients, invoices, revenue, recentActivity] =
            await Promise.all([
                this.appointmentModel.aggregate([
                    { $match: { clinicId, startTime: { $gte: today.start, $lt: today.end }, ...own } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ]),
                this.appointmentModel
                    .find({ clinicId, startTime: { $gte: now }, status: { $in: [S.SCHEDULED, S.CONFIRMED] }, ...own })
                    .sort({ startTime: 1 })
                    .limit(5)
                    .populate('patientId', 'firstName lastName patronymic')
                    .populate('dentistId', 'firstName lastName')
                    .lean(),
                this.patientModel.countDocuments({ clinicId, status: PatientStatus.ACTIVE }),
                this.patientModel.countDocuments({ clinicId, createdAt: { $gte: month.start, $lt: month.end } }),
                seesBilling(role)
                    ? this.invoiceModel.aggregate([
                          { $match: { clinicId, currency, status: { $in: OPEN_STATUSES } } },
                          {
                              $group: {
                                  _id: null,
                                  open: { $sum: 1 },
                                  balance: { $sum: balance },
                                  overdue: { $sum: { $cond: [isOverdue, 1, 0] } },
                              },
                          },
                      ])
                    : Promise.resolve(null),
                seesRevenue(role) ? this.collectedTotal(clinicId, currency, month.start, month.end) : Promise.resolve(null),
                this.recentActivity(viewer, currency),
            ]);

        const count = (status: AppointmentStatus) => todayByStatus.find((s) => s._id === status)?.count ?? 0;
        return {
            timezone,
            ownAppointments: role === Role.DENTIST,
            today: {
                appointments: todayByStatus
                    .filter((s) => s._id !== S.CANCELLED)
                    .reduce((sum, s) => sum + s.count, 0),
                completed: count(S.COMPLETED),
                noShow: count(S.NO_SHOW),
            },
            activePatients,
            newPatientsThisMonth: newPatients,
            ...(invoices
                ? {
                      invoices: {
                          currency,
                          open: invoices[0]?.open ?? 0,
                          overdue: invoices[0]?.overdue ?? 0,
                          outstanding: toMajor(invoices[0]?.balance ?? 0, currency),
                      },
                  }
                : {}),
            ...(revenue ? { monthRevenue: { currency, amount: toMajor(revenue.total, currency) } } : {}),
            upcomingAppointments: upcoming,
            recentActivity,
        };
    }

    /**
     * Latest things that happened in the clinic, newest first, built from the
     * records themselves until there is an audit log (F7). Money items only
     * for roles that can see billing.
     */
    private async recentActivity(viewer: ReportViewer, currency: Currency) {
        const { clinicId, role } = viewer;
        const n = ACTIVITY_PER_SOURCE;
        const patientRef = { path: 'patientId', select: 'firstName lastName patronymic' };
        const billing = seesBilling(role);

        const [patients, appointments, entries, invoices, payments] = await Promise.all([
            this.patientModel
                .find({ clinicId })
                .sort({ createdAt: -1 })
                .limit(n)
                .select('firstName lastName patronymic createdAt statusHistory')
                .lean(),
            this.appointmentModel
                .find({ clinicId })
                .sort({ createdAt: -1 })
                .limit(n)
                .select('patientId startTime createdAt')
                .populate(patientRef)
                .lean(),
            this.entryModel
                .find({ clinicId, status: TreatmentEntryStatus.DONE, voidedAt: null })
                .sort({ updatedAt: -1 })
                .limit(n)
                .select('patientId treatmentName dentistId completedAt date updatedAt')
                .populate(patientRef)
                .lean(),
            billing
                ? this.invoiceModel
                      .find({ clinicId, issuedAt: { $ne: null } })
                      .sort({ issuedAt: -1 })
                      .limit(n)
                      .select('patientId invoiceNumber totalAmount currency issuedAt issuedBy')
                      .populate(patientRef)
                      .lean()
                : Promise.resolve([]),
            billing
                ? this.paymentModel
                      .find({ clinicId, voidedAt: null })
                      .sort({ createdAt: -1 })
                      .limit(n)
                      .select('invoiceId patientId amount currency createdAt receivedBy')
                      .populate(patientRef)
                      .lean()
                : Promise.resolve([]),
        ]);

        const at = (d: unknown) => (d ? new Date(d as string) : new Date(0));
        const items = [
            ...patients.map((p) => ({
                type: 'patient' as const,
                id: String(p._id),
                at: at((p as any).createdAt),
                patient: { _id: p._id, firstName: p.firstName, lastName: p.lastName, patronymic: p.patronymic },
                byId: idOf(p.statusHistory?.[0]?.changedBy),
            })),
            ...appointments.map((a) => ({
                type: 'appointment' as const,
                id: String(a._id),
                at: at((a as any).createdAt),
                patient: a.patientId,
                startTime: a.startTime,
            })),
            ...entries.map((e) => ({
                type: 'treatment' as const,
                id: idOf((e.patientId as any)?._id ?? e.patientId),
                at: at(e.completedAt ?? (e as any).updatedAt ?? e.date),
                patient: e.patientId,
                treatmentName: e.treatmentName,
                byId: idOf(e.dentistId),
            })),
            ...invoices.map((i: any) => ({
                type: 'invoice' as const,
                id: String(i._id),
                at: at(i.issuedAt),
                patient: i.patientId,
                invoiceNumber: i.invoiceNumber,
                amount: toMajor(i.totalAmount, i.currency ?? currency),
                currency: i.currency ?? currency,
                byId: idOf(i.issuedBy),
            })),
            ...payments.map((p: any) => ({
                type: 'payment' as const,
                id: String(p.invoiceId),
                at: at(p.createdAt),
                patient: p.patientId,
                amount: toMajor(p.amount, p.currency ?? currency),
                currency: p.currency ?? currency,
                byId: idOf(p.receivedBy),
            })),
        ]
            .sort((x, y) => y.at.getTime() - x.at.getTime())
            .slice(0, ACTIVITY_LIMIT);

        const userIds = [...new Set(items.map((i) => (i as { byId?: string }).byId).filter(Boolean))] as string[];
        const users = userIds.length
            ? await this.userModel.find({ _id: { $in: userIds }, clinicId }).select('firstName lastName').lean()
            : [];
        const userById = new Map(users.map((u) => [String(u._id), { firstName: u.firstName, lastName: u.lastName }]));

        return items.map(({ byId, ...item }: { byId?: string } & Record<string, any>) => ({
            ...item,
            by: byId ? userById.get(byId) ?? null : null,
        }));
    }
}
