import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Connection, Error as MongooseError, FilterQuery, Model, Types } from 'mongoose';
import {
    DentalRecord,
    DentalRecordDocument,
    SurfaceState,
    SurfaceStatus,
    ToothRecord,
    ToothStatus,
    ToothSurface,
} from './dental-record.schema';
import { TreatmentEntry, TreatmentEntryDocument, TreatmentEntryStatus } from './treatment-entry.schema';
import {
    UpdateToothDto,
    CreateTreatmentEntryDto,
    CompleteTreatmentEntryDto,
    QueryRecordsDto,
} from './dto';
import { ChartType, isFdiTooth, teethFor, universalToFdi } from './tooth-numbering';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { runOnce } from 'src/common/migrations/run-once';
import { errorBody } from 'src/common/utils';

/** A concurrent save makes us reload and re-apply; after this many tries the caller gets a 409. */
const CHART_SAVE_ATTEMPTS = 5;

/** Whole-tooth results that replace the crown, so earlier surface findings no longer apply. */
const CLEARS_SURFACES = [ToothStatus.MISSING, ToothStatus.IMPLANT, ToothStatus.CROWN];

const TREATED_STATUSES = [
    ToothStatus.FILLED,
    ToothStatus.CROWN,
    ToothStatus.ROOT_CANAL,
    ToothStatus.IMPLANT,
    ToothStatus.BRIDGE,
    ToothStatus.VENEER,
];

const PERSON = 'firstName lastName';

const ENTRY_POPULATE = [
    { path: 'dentistId', select: PERSON },
    { path: 'treatmentId', select: 'name nameHy nameRu code' },
    { path: 'appointmentId', select: 'title startTime' },
    { path: 'createdBy', select: PERSON },
    { path: 'completedBy', select: PERSON },
    { path: 'voidedBy', select: PERSON },
];

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Mongo dates from a `YYYY-MM-DD` filter: the end date is inclusive. */
const dayAfter = (date: string) => {
    const d = new Date(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) d.setUTCDate(d.getUTCDate() + 1);
    return d;
};

type SurfaceInput = { surface: ToothSurface | string; status: SurfaceStatus | string };

interface ToothChange {
    toothNumber: number;
    status?: ToothStatus;
    surfaces?: SurfaceInput[];
    conditions?: string[];
    notes?: string;
}

const plainSurfaces = (surfaces: SurfaceInput[] = []): SurfaceState[] =>
    surfaces.map((s) => ({ surface: s.surface as ToothSurface, status: s.status as SurfaceStatus }));

const surfaceKey = (surfaces: SurfaceInput[]) =>
    surfaces
        .map((s) => `${s.surface}:${s.status}`)
        .sort()
        .join(',');

const sameMembers = (a: string[], b: string[]) => a.length === b.length && a.every((value) => b.includes(value));

/**
 * Legacy surfaces were a bare list of names sharing the tooth's single status.
 * Keep them as decay when the tooth was marked decayed, otherwise as fillings.
 */
const legacySurfaces = (surfaces: unknown, toothStatus: string): SurfaceState[] => {
    if (!Array.isArray(surfaces)) return [];
    const status = [ToothStatus.DECAYED, ToothStatus.NEEDS_TREATMENT].includes(toothStatus as ToothStatus)
        ? SurfaceStatus.DECAYED
        : SurfaceStatus.FILLED;
    const known = Object.values(ToothSurface) as string[];
    return surfaces.flatMap((s) => {
        if (s && typeof s === 'object') return [s as SurfaceState];
        return typeof s === 'string' && known.includes(s) ? [{ surface: s as ToothSurface, status }] : [];
    });
};

@Injectable()
export class DentalRecordsService implements OnModuleInit {
    private readonly logger = new Logger(DentalRecordsService.name);

    constructor(
        @InjectModel(DentalRecord.name)
        private readonly dentalRecordModel: Model<DentalRecordDocument>,
        @InjectModel(TreatmentEntry.name)
        private readonly treatmentEntryModel: Model<TreatmentEntryDocument>,
        @InjectConnection() private readonly connection: Connection,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    /** One-off data fixes; each runs once per database (see `runOnce`). */
    async onModuleInit(): Promise<void> {
        await runOnce(this.connection, '2026-10-dental-fdi-numbering', this.logger, () => this.convertToFdi());
    }

    /**
     * Universal → FDI (D1) for charts, tooth history and treatment entries, and
     * the old one-status-for-all-surfaces list → per-surface states.
     *
     * Works on the raw collections with a marker per document (`numbering` on
     * charts, the old `toothNumber` field on entries), so a run that stops
     * half-way is finished on the next start without converting anything twice.
     */
    private async convertToFdi(): Promise<number> {
        const fdi = (n: number) => universalToFdi(n) ?? n;
        let changed = 0;

        const charts = this.dentalRecordModel.collection;
        let chartOps: AnyBulkWriteOperation[] = [];
        for await (const chart of charts.find({ numbering: { $ne: 'fdi' } })) {
            const teeth = (chart.teeth ?? []).map((tooth: any) => ({
                ...tooth,
                toothNumber: fdi(tooth.toothNumber),
                surfaces: legacySurfaces(tooth.surfaces, tooth.status),
                history: (tooth.history ?? []).map((h: any) => ({
                    ...h,
                    surfaces: legacySurfaces(h.surfaces, h.status),
                })),
            }));
            chartOps.push({
                updateOne: {
                    filter: { _id: chart._id, numbering: { $ne: 'fdi' } },
                    update: { $set: { teeth, numbering: 'fdi', archivedCharts: [] }, $inc: { __v: 1 } },
                },
            });
            if (chartOps.length >= 500) {
                changed += (await charts.bulkWrite(chartOps)).modifiedCount;
                chartOps = [];
            }
        }
        if (chartOps.length) changed += (await charts.bulkWrite(chartOps)).modifiedCount;

        const entries = this.treatmentEntryModel.collection;
        let entryOps: AnyBulkWriteOperation[] = [];
        for await (const entry of entries.find({ toothNumber: { $exists: true } })) {
            const tooth = entry.toothNumber;
            entryOps.push({
                updateOne: {
                    filter: { _id: entry._id, toothNumber: { $exists: true } },
                    update: {
                        $set: {
                            teeth: typeof tooth === 'number' ? [fdi(tooth)] : [],
                            status: entry.status ?? TreatmentEntryStatus.DONE,
                        },
                        $unset: { toothNumber: '' },
                    },
                },
            });
            if (entryOps.length >= 500) {
                changed += (await entries.bulkWrite(entryOps)).modifiedCount;
                entryOps = [];
            }
        }
        if (entryOps.length) changed += (await entries.bulkWrite(entryOps)).modifiedCount;

        const indexes = await entries.indexes();
        const legacyIndex = indexes.find((i) => i.key?.toothNumber !== undefined);
        if (legacyIndex?.name) await entries.dropIndex(legacyIndex.name);

        if (changed) this.logger.log(`Converted ${changed} charts/entries to FDI numbering`);
        return changed;
    }

    // ── Chart ────────────────────────────────────────────────────────────────

    /**
     * Get or create a dental chart for a patient. `chartType` only applies to a
     * new chart. Two first opens at the same time used to fail with a 500 on
     * the unique index; the loser now reads the winner's chart.
     */
    async getOrCreateChart(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        chartType: ChartType = 'adult',
    ): Promise<DentalRecordDocument> {
        const existing = await this.dentalRecordModel.findOne({ clinicId, patientId });
        if (existing) return existing;

        // Only on first creation: a GET for any random id used to create a chart.
        await this.clinicRefs.assertPatient(clinicId, patientId);

        try {
            return await this.dentalRecordModel.create({
                clinicId,
                patientId,
                chartType,
                teeth: this.generateDefaultTeeth(chartType),
            });
        } catch (err) {
            if (isDuplicateKey(err)) {
                const winner = await this.dentalRecordModel.findOne({ clinicId, patientId });
                if (winner) return winner;
            }
            throw err;
        }
    }

    async getChart(clinicId: Types.ObjectId, patientId: Types.ObjectId, chartType?: ChartType) {
        return this.toResponse(await this.getOrCreateChart(clinicId, patientId, chartType));
    }

    /**
     * Load, change and save a chart. The schema uses optimistic concurrency, so
     * a save that raced another one fails; we reload and apply the change again
     * (edits to different teeth both survive). `mutate` must be safe to re-run.
     */
    private async mutateChart(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        mutate: (chart: DentalRecordDocument) => void,
    ): Promise<DentalRecordDocument> {
        for (let attempt = 1; ; attempt++) {
            const chart = await this.getOrCreateChart(clinicId, patientId);
            mutate(chart);
            if (!chart.isModified()) return chart;
            try {
                return await chart.save();
            } catch (err) {
                if (!(err instanceof MongooseError.VersionError)) throw err;
                if (attempt >= CHART_SAVE_ATTEMPTS) {
                    throw new ConflictException(
                        errorBody('chartChanged', 'The chart was changed by someone else. Reload and try again.'),
                    );
                }
            }
        }
    }

    /**
     * Switch between the permanent and primary chart (D6). The current teeth
     * are archived, never deleted, and switching back restores them — a
     * mis-click used to wipe the whole chart and its history.
     */
    async setChartType(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        chartType: ChartType,
        userId: Types.ObjectId,
    ) {
        const chart = await this.mutateChart(clinicId, patientId, (chart) => {
            if (chart.chartType === chartType) return;

            const archived = chart.toObject().archivedCharts ?? [];
            const restoreIndex = archived.map((a) => a.chartType).lastIndexOf(chartType);
            const restored = restoreIndex >= 0 ? archived[restoreIndex].teeth : null;

            chart.archivedCharts = [
                ...archived.filter((_, i) => i !== restoreIndex),
                {
                    chartType: chart.chartType,
                    teeth: chart.toObject().teeth,
                    archivedAt: new Date(),
                    archivedBy: userId,
                },
            ];
            chart.teeth = (restored ?? this.generateDefaultTeeth(chartType)) as ToothRecord[];
            chart.chartType = chartType;
            chart.lastUpdatedBy = userId;
            chart.markModified('teeth');
            chart.markModified('archivedCharts');
        });
        return this.toResponse(chart);
    }

    async updateTooth(clinicId: Types.ObjectId, patientId: Types.ObjectId, dto: UpdateToothDto, userId: Types.ObjectId) {
        const chart = await this.mutateChart(clinicId, patientId, (chart) => this.applyToothUpdate(chart, dto, userId));
        return this.toResponse(chart);
    }

    async updateMultipleTeeth(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        teeth: UpdateToothDto[],
        userId: Types.ObjectId,
    ) {
        if (!teeth?.length) {
            throw new BadRequestException(errorBody('validationFailed', 'At least one tooth must be provided'));
        }
        const chart = await this.mutateChart(clinicId, patientId, (chart) =>
            teeth.forEach((dto) => this.applyToothUpdate(chart, dto, userId)),
        );
        return this.toResponse(chart);
    }

    /**
     * Apply one tooth update in place and append a history entry whenever the
     * status, surfaces, conditions or notes actually change, so the previous
     * state stays visible in the tooth's timeline.
     */
    private applyToothUpdate(
        chart: DentalRecordDocument,
        change: ToothChange,
        userId: Types.ObjectId,
        treatmentEntryId?: Types.ObjectId,
    ): void {
        const tooth = chart.teeth.find((t) => t.toothNumber === change.toothNumber);
        if (!tooth) {
            throw new NotFoundException(
                errorBody('toothNotInChart', `Tooth ${change.toothNumber} is not on this ${chart.chartType} chart`),
            );
        }

        if (change.surfaces) {
            const names = change.surfaces.map((s) => s.surface);
            if (new Set(names).size !== names.length) {
                throw new BadRequestException(errorBody('duplicateSurface', 'Each surface can appear only once'));
            }
        }

        const currentSurfaces = plainSurfaces(tooth.surfaces);
        const previousStatus = tooth.status;
        const nextStatus = change.status ?? tooth.status;
        const nextSurfaces = change.surfaces ? plainSurfaces(change.surfaces) : currentSurfaces;
        const nextConditions = change.conditions ?? tooth.conditions ?? [];
        const nextNotes = change.notes ?? tooth.notes ?? '';

        const changed =
            nextStatus !== previousStatus ||
            nextNotes !== (tooth.notes ?? '') ||
            surfaceKey(nextSurfaces) !== surfaceKey(currentSurfaces) ||
            !sameMembers(nextConditions, tooth.conditions ?? []);

        if (!changed) return;

        const now = new Date();
        tooth.status = nextStatus;
        tooth.surfaces = nextSurfaces;
        tooth.conditions = nextConditions;
        tooth.notes = nextNotes;
        tooth.updatedAt = now;
        tooth.updatedBy = userId;
        tooth.history = [
            ...(tooth.history || []),
            {
                previousStatus,
                status: nextStatus,
                surfaces: nextSurfaces,
                conditions: [...nextConditions],
                notes: nextNotes,
                changedBy: userId,
                changedAt: now,
                treatmentEntryId,
            } as ToothRecord['history'][number],
        ];

        chart.lastUpdatedBy = userId;
        chart.markModified('teeth');
    }

    /**
     * A done treatment updates the teeth it was done on: an extraction makes
     * the tooth missing, a filling turns the treated surfaces from decayed to
     * filled. Teeth not on the current chart (an erupted permanent molar on a
     * primary chart) are skipped.
     */
    private async applyTreatmentResult(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        entry: { _id: Types.ObjectId; teeth: number[]; surfaces: ToothSurface[]; resultStatus?: ToothStatus },
        userId: Types.ObjectId,
    ): Promise<void> {
        const result = entry.resultStatus;
        if (!result || !entry.teeth.length) return;

        await this.mutateChart(clinicId, patientId, (chart) => {
            for (const toothNumber of entry.teeth) {
                const tooth = chart.teeth.find((t) => t.toothNumber === toothNumber);
                if (!tooth) continue;

                let surfaces = plainSurfaces(tooth.surfaces);
                if (CLEARS_SURFACES.includes(result)) {
                    surfaces = [];
                } else if (result === ToothStatus.FILLED && entry.surfaces.length) {
                    surfaces = [
                        ...surfaces.filter((s) => !entry.surfaces.includes(s.surface)),
                        ...entry.surfaces.map((surface) => ({ surface, status: SurfaceStatus.FILLED })),
                    ];
                }
                const stillDecayed = surfaces.some((s) => s.status === SurfaceStatus.DECAYED);
                const status = result === ToothStatus.FILLED && stillDecayed ? ToothStatus.DECAYED : result;

                this.applyToothUpdate(chart, { toothNumber, status, surfaces }, userId, entry._id);
            }
        });
    }

    /**
     * The full timeline of a single tooth: status changes from the chart plus
     * the treatment entries recorded against that tooth.
     */
    async getToothHistory(clinicId: Types.ObjectId, patientId: Types.ObjectId, toothNumber: number) {
        if (!isFdiTooth(toothNumber)) {
            throw new BadRequestException(errorBody('invalidTooth', `${toothNumber} is not an FDI tooth number`));
        }

        const chart = await this.getOrCreateChart(clinicId, patientId);
        const tooth = chart.toObject().teeth.find((t) => t.toothNumber === toothNumber);

        const [statusHistory, treatments] = await Promise.all([
            this.dentalRecordModel.populate(
                [...(tooth?.history ?? [])].sort(
                    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
                ),
                { path: 'changedBy', select: PERSON, model: 'User' },
            ),
            this.treatmentEntryModel
                .find({ clinicId, patientId, teeth: toothNumber, voidedAt: null })
                .sort({ date: -1, _id: -1 })
                .populate(ENTRY_POPULATE)
                .lean(),
        ]);

        return {
            toothNumber,
            current: tooth
                ? {
                      status: tooth.status,
                      surfaces: tooth.surfaces,
                      conditions: tooth.conditions,
                      notes: tooth.notes,
                      updatedAt: tooth.updatedAt,
                  }
                : null,
            statusHistory,
            treatments,
        };
    }

    // ── Treatment entries ────────────────────────────────────────────────────

    /**
     * Record a treatment, done or planned. A done one updates the chart first,
     * so a failed chart save never leaves an entry the chart doesn't reflect.
     */
    async addTreatmentEntry(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: CreateTreatmentEntryDto,
    ) {
        const teeth = dto.teeth ?? [];
        const invalid = teeth.filter((n) => !isFdiTooth(n));
        if (invalid.length) {
            throw new BadRequestException(errorBody('invalidTooth', `Not FDI tooth numbers: ${invalid.join(', ')}`));
        }

        const [treatment] = await Promise.all([
            dto.treatmentId ? this.clinicRefs.getTreatment(clinicId, dto.treatmentId) : null,
            this.clinicRefs.assertPatient(clinicId, patientId),
            dto.dentistId && this.clinicRefs.assertDentist(clinicId, dto.dentistId),
            dto.appointmentId && this.clinicRefs.assertAppointment(clinicId, dto.appointmentId, patientId),
        ]);

        const status = dto.status ?? TreatmentEntryStatus.DONE;
        const done = status === TreatmentEntryStatus.DONE;
        const now = new Date();
        const entry = {
            _id: new Types.ObjectId(),
            clinicId,
            patientId,
            teeth,
            status,
            // The caller may attribute the treatment to another dentist (an
            // admin recording it); otherwise it is the current user.
            dentistId: dto.dentistId ? new Types.ObjectId(dto.dentistId) : userId,
            treatmentName: dto.treatmentName,
            treatmentId: dto.treatmentId ? new Types.ObjectId(dto.treatmentId) : undefined,
            appointmentId: dto.appointmentId ? new Types.ObjectId(dto.appointmentId) : undefined,
            surfaces: dto.surfaces ?? [],
            resultStatus: dto.resultStatus ?? (treatment?.toothStatus as ToothStatus | undefined),
            notes: dto.notes,
            cost: dto.cost,
            currency: dto.currency,
            date: dto.date ? new Date(dto.date) : now,
            createdBy: userId,
            completedAt: done ? now : undefined,
            completedBy: done ? userId : undefined,
        };

        if (done) await this.applyTreatmentResult(clinicId, patientId, entry, userId);

        const created = await this.treatmentEntryModel.create(entry);
        return created.populate(ENTRY_POPULATE);
    }

    /** Planned → done. Updates the chart; if that fails the entry goes back to planned. */
    async completeTreatmentEntry(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        entryId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: CompleteTreatmentEntryDto,
    ) {
        const now = new Date();
        const entry = await this.treatmentEntryModel.findOneAndUpdate(
            { _id: entryId, clinicId, patientId, status: TreatmentEntryStatus.PLANNED, voidedAt: null },
            {
                $set: {
                    status: TreatmentEntryStatus.DONE,
                    date: dto.date ? new Date(dto.date) : now,
                    completedAt: now,
                    completedBy: userId,
                },
            },
            { new: true },
        );
        if (!entry) throw await this.entryStateError(clinicId, patientId, entryId, 'complete');

        try {
            await this.applyTreatmentResult(clinicId, patientId, entry, userId);
        } catch (err) {
            await this.treatmentEntryModel.updateOne(
                { _id: entryId, status: TreatmentEntryStatus.DONE },
                {
                    $set: { status: TreatmentEntryStatus.PLANNED },
                    $unset: { completedAt: '', completedBy: '' },
                },
            );
            throw err;
        }

        return entry.populate(ENTRY_POPULATE);
    }

    /**
     * Entries are never deleted. Voiding hides one from the history and keeps
     * who, when and why; it does not undo chart changes (the tooth history
     * shows them, and the tooth can be corrected by hand). A billed entry
     * cannot be voided until its invoice is cancelled.
     */
    async voidTreatmentEntry(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        entryId: Types.ObjectId,
        userId: Types.ObjectId,
        reason: string,
    ) {
        const entry = await this.treatmentEntryModel
            .findOneAndUpdate(
                { _id: entryId, clinicId, patientId, voidedAt: null, invoiceId: null },
                { $set: { voidedAt: new Date(), voidedBy: userId, voidReason: reason } },
                { new: true },
            )
            .populate(ENTRY_POPULATE);
        if (!entry) throw await this.entryStateError(clinicId, patientId, entryId, 'void');
        return entry;
    }

    /** Why a conditional entry update matched nothing. */
    private async entryStateError(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        entryId: Types.ObjectId,
        operation: 'complete' | 'void',
    ) {
        const entry = await this.treatmentEntryModel.findOne({ _id: entryId, clinicId, patientId }).lean();
        if (!entry) {
            return new NotFoundException(errorBody('treatmentEntryNotFound', 'Treatment entry not found'));
        }
        if (entry.voidedAt) {
            return new BadRequestException(errorBody('treatmentEntryVoided', 'This entry was voided'));
        }
        if (operation === 'void' && entry.invoiceId) {
            return new BadRequestException(
                errorBody('treatmentEntryBilled', 'This entry is on an invoice. Cancel the invoice first.'),
            );
        }
        return new BadRequestException(errorBody('treatmentEntryAlreadyDone', 'This treatment is already done'));
    }

    /**
     * Treatment history for a patient, optionally filtered by tooth, status and
     * date range. Voided entries are left out unless asked for. Newest first.
     */
    async getTreatmentHistory(clinicId: Types.ObjectId, patientId: Types.ObjectId, query: QueryRecordsDto) {
        const filter: FilterQuery<TreatmentEntryDocument> = { clinicId, patientId };

        if (!query.includeVoided) filter.voidedAt = null;
        if (query.status) filter.status = query.status;
        if (query.toothNumber !== undefined) filter.teeth = query.toothNumber;

        if (query.startDate || query.endDate) {
            filter.date = {};
            if (query.startDate) filter.date.$gte = new Date(query.startDate);
            if (query.endDate) filter.date.$lt = dayAfter(query.endDate);
        }

        const page = query.page || 1;
        const limit = query.limit || 20;

        const [entries, total] = await Promise.all([
            this.treatmentEntryModel
                .find(filter)
                .sort({ date: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate(ENTRY_POPULATE)
                .lean(),
            this.treatmentEntryModel.countDocuments(filter),
        ]);

        return {
            data: entries,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * A summary of the patient's dental health: teeth by status, plus decay on
     * any surface counting as "needs attention".
     */
    async getPatientDentalSummary(clinicId: Types.ObjectId, patientId: Types.ObjectId) {
        const chart = await this.getOrCreateChart(clinicId, patientId);
        const live = { clinicId, patientId, voidedAt: null };

        const [treatmentCount, plannedCount] = await Promise.all([
            this.treatmentEntryModel.countDocuments({ ...live, status: TreatmentEntryStatus.DONE }),
            this.treatmentEntryModel.countDocuments({ ...live, status: TreatmentEntryStatus.PLANNED }),
        ]);

        const count = (match: (t: ToothRecord) => boolean) => chart.teeth.filter(match).length;

        return {
            chartType: chart.chartType,
            totalTeeth: chart.teeth.length,
            healthyCount: count((t) => t.status === ToothStatus.HEALTHY && !t.surfaces?.length),
            treatedCount: count((t) => TREATED_STATUSES.includes(t.status)),
            missingCount: count((t) => t.status === ToothStatus.MISSING),
            needsAttentionCount: count(
                (t) =>
                    [ToothStatus.DECAYED, ToothStatus.NEEDS_TREATMENT].includes(t.status) ||
                    (t.surfaces ?? []).some((s) => s.status === SurfaceStatus.DECAYED),
            ),
            totalTreatmentEntries: treatmentCount,
            plannedTreatmentEntries: plannedCount,
            lastUpdatedBy: chart.lastUpdatedBy,
            updatedAt: (chart as any).updatedAt,
        };
    }

    /** The chart without the archived teeth, which only the server needs; their types are listed instead. */
    private toResponse(chart: DentalRecordDocument) {
        const { archivedCharts, ...rest } = chart.toObject();
        return { ...rest, archivedChartTypes: (archivedCharts ?? []).map((a) => a.chartType) };
    }

    private generateDefaultTeeth(chartType: ChartType) {
        return teethFor(chartType).map((toothNumber) => ({
            toothNumber,
            status: ToothStatus.HEALTHY,
            surfaces: [],
            conditions: [],
            notes: '',
            history: [],
        }));
    }
}
