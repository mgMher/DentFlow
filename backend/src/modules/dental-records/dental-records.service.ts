import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    DentalRecord,
    DentalRecordDocument,
    ToothRecord,
    ToothStatus,
} from './dental-record.schema';
import { TreatmentEntry, TreatmentEntryDocument } from './treatment-entry.schema';
import { UpdateToothDto, CreateTreatmentEntryDto, QueryRecordsDto } from './dto';

@Injectable()
export class DentalRecordsService {
    constructor(
        @InjectModel(DentalRecord.name)
        private readonly dentalRecordModel: Model<DentalRecordDocument>,
        @InjectModel(TreatmentEntry.name)
        private readonly treatmentEntryModel: Model<TreatmentEntryDocument>,
    ) {}

    /**
     * Get or create a dental chart for a patient.
     * If no chart exists, creates one with all teeth set to HEALTHY.
     * Adult charts have teeth 1-32, pediatric charts have teeth 51-70 (A-T mapped).
     */
    async getOrCreateChart(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        chartType: 'adult' | 'pediatric' = 'adult',
    ): Promise<DentalRecordDocument> {
        let chart = await this.dentalRecordModel.findOne({
            clinicId,
            patientId,
        });

        if (chart) {
            return chart;
        }

        const teeth = this.generateDefaultTeeth(chartType);

        chart = await this.dentalRecordModel.create({
            clinicId,
            patientId,
            chartType,
            teeth,
        });

        return chart;
    }

    /**
     * Switch a chart between adult (teeth 1-32) and pediatric (51-70).
     *
     * The two numbering schemes share no tooth numbers, so the teeth array is
     * rebuilt from scratch — per-tooth status and history for the old scheme
     * cannot be carried over. Recorded treatment entries live in their own
     * collection and are left untouched.
     */
    async setChartType(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        chartType: 'adult' | 'pediatric',
        userId: Types.ObjectId,
    ): Promise<DentalRecordDocument> {
        const chart = await this.getOrCreateChart(clinicId, patientId, chartType);

        if (chart.chartType === chartType) {
            return chart;
        }

        chart.chartType = chartType;
        chart.teeth = this.generateDefaultTeeth(chartType) as ToothRecord[];
        chart.lastUpdatedBy = userId;
        chart.markModified('teeth');

        return chart.save();
    }

    /**
     * Get an existing dental chart for a patient.
     * Returns null if no chart exists.
     */
    async getChart(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
    ): Promise<DentalRecordDocument | null> {
        return this.dentalRecordModel.findOne({
            clinicId,
            patientId,
        });
    }

    /**
     * Update a single tooth in the patient's dental chart.
     * Creates the chart if it doesn't exist.
     */
    async updateTooth(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        dto: UpdateToothDto,
        userId: Types.ObjectId,
    ): Promise<DentalRecordDocument> {
        const chart = await this.getOrCreateChart(clinicId, patientId);

        this.applyToothUpdate(chart, dto, userId);

        chart.lastUpdatedBy = userId;

        return chart.save();
    }

    /**
     * Update multiple teeth in the patient's dental chart in a single operation.
     * Creates the chart if it doesn't exist.
     */
    async updateMultipleTeeth(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        teeth: UpdateToothDto[],
        userId: Types.ObjectId,
    ): Promise<DentalRecordDocument> {
        if (!teeth?.length) {
            throw new BadRequestException('At least one tooth must be provided');
        }

        const chart = await this.getOrCreateChart(clinicId, patientId);

        teeth.forEach((dto) => this.applyToothUpdate(chart, dto, userId));

        chart.lastUpdatedBy = userId;

        return chart.save();
    }

    /**
     * Apply one tooth update in place and append a history entry whenever the
     * status, surfaces, conditions or notes actually change, so the previous
     * state stays visible in the tooth's timeline.
     */
    private applyToothUpdate(
        chart: DentalRecordDocument,
        dto: UpdateToothDto,
        userId: Types.ObjectId,
    ): void {
        const tooth = chart.teeth.find((t) => t.toothNumber === dto.toothNumber);

        if (!tooth) {
            throw new NotFoundException(
                `Tooth number ${dto.toothNumber} not found in chart`,
            );
        }

        const previousStatus = tooth.status;
        const nextStatus = dto.status ?? tooth.status;
        const nextSurfaces = dto.surfaces ?? tooth.surfaces ?? [];
        const nextConditions = dto.conditions ?? tooth.conditions ?? [];
        const nextNotes = dto.notes ?? tooth.notes ?? '';

        const changed =
            nextStatus !== previousStatus ||
            nextNotes !== (tooth.notes ?? '') ||
            !this.sameMembers(nextSurfaces, tooth.surfaces ?? []) ||
            !this.sameMembers(nextConditions, tooth.conditions ?? []);

        if (!changed) {
            return;
        }

        tooth.status = nextStatus;
        tooth.surfaces = nextSurfaces;
        tooth.conditions = nextConditions;
        tooth.notes = nextNotes;
        tooth.updatedAt = new Date();

        tooth.history = [
            ...(tooth.history || []),
            {
                previousStatus,
                status: nextStatus,
                surfaces: [...nextSurfaces],
                conditions: [...nextConditions],
                notes: nextNotes,
                changedBy: userId,
                changedAt: new Date(),
            } as ToothRecord['history'][number],
        ];

        chart.markModified('teeth');
    }

    private sameMembers(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every((value) => b.includes(value));
    }

    /**
     * The full timeline of a single tooth: status changes from the chart plus
     * the treatment entries recorded against that tooth.
     */
    async getToothHistory(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        toothNumber: number,
    ) {
        const chart = await this.getOrCreateChart(clinicId, patientId);
        const tooth = chart.teeth.find((t) => t.toothNumber === toothNumber);

        if (!tooth) {
            throw new NotFoundException(`Tooth number ${toothNumber} not found in chart`);
        }

        const treatments = await this.treatmentEntryModel
            .find({ clinicId, patientId, toothNumber })
            .sort({ date: -1 })
            .populate('dentistId', 'firstName lastName')
            .populate('treatmentId', 'name')
            .lean();

        return {
            toothNumber,
            current: {
                status: tooth.status,
                surfaces: tooth.surfaces,
                conditions: tooth.conditions,
                notes: tooth.notes,
                updatedAt: tooth.updatedAt,
            },
            statusHistory: [...(tooth.history || [])].sort(
                (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
            ),
            treatments,
        };
    }

    /**
     * Add a treatment entry for a specific tooth.
     * Records the treatment history including dentist, surfaces, cost, and notes.
     */
    async addTreatmentEntry(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        dentistId: Types.ObjectId,
        dto: CreateTreatmentEntryDto,
    ): Promise<TreatmentEntryDocument> {
        const chart = await this.getOrCreateChart(clinicId, patientId);

        if (!chart.teeth.some((t) => t.toothNumber === dto.toothNumber)) {
            throw new NotFoundException(
                `Tooth number ${dto.toothNumber} not found in chart`,
            );
        }

        const entry = await this.treatmentEntryModel.create({
            clinicId,
            patientId,
            // The caller may attribute the treatment to another dentist (e.g. a
            // receptionist recording it); otherwise it is the current user.
            dentistId: dto.dentistId ? new Types.ObjectId(dto.dentistId) : dentistId,
            toothNumber: dto.toothNumber,
            treatmentName: dto.treatmentName,
            treatmentId: dto.treatmentId
                ? new Types.ObjectId(dto.treatmentId)
                : undefined,
            appointmentId: dto.appointmentId
                ? new Types.ObjectId(dto.appointmentId)
                : undefined,
            surfaces: dto.surfaces || [],
            notes: dto.notes,
            cost: dto.cost,
            currency: dto.currency,
            date: dto.date ? new Date(dto.date) : new Date(),
        });

        return entry.populate([
            { path: 'dentistId', select: 'firstName lastName' },
            { path: 'treatmentId', select: 'name' },
        ]);
    }

    /**
     * Get treatment history for a patient, optionally filtered by tooth number and date range.
     * Results are paginated and sorted by date descending (newest first).
     */
    async getTreatmentHistory(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        query: QueryRecordsDto,
    ) {
        const filter: any = { clinicId, patientId };

        if (query.toothNumber !== undefined) {
            filter.toothNumber = query.toothNumber;
        }

        if (query.startDate || query.endDate) {
            filter.date = {};
            if (query.startDate) {
                filter.date.$gte = new Date(query.startDate);
            }
            if (query.endDate) {
                filter.date.$lte = new Date(query.endDate);
            }
        }

        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;

        const [entries, total] = await Promise.all([
            this.treatmentEntryModel
                .find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .populate('dentistId', 'firstName lastName')
                .populate('treatmentId', 'name')
                .populate('appointmentId', 'title startTime')
                .lean(),
            this.treatmentEntryModel.countDocuments(filter),
        ]);

        return {
            data: entries,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a summary of the patient's dental health.
     * Counts teeth by status category: healthy, treated, missing, and needs attention.
     */
    async getPatientDentalSummary(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
    ) {
        const chart = await this.getOrCreateChart(clinicId, patientId);

        const treatmentCount = await this.treatmentEntryModel.countDocuments({
            clinicId,
            patientId,
        });

        const healthyCount = chart.teeth.filter(
            (t) => t.status === ToothStatus.HEALTHY,
        ).length;

        const treatedCount = chart.teeth.filter((t) =>
            [
                ToothStatus.FILLED,
                ToothStatus.CROWN,
                ToothStatus.ROOT_CANAL,
                ToothStatus.IMPLANT,
                ToothStatus.BRIDGE,
                ToothStatus.VENEER,
            ].includes(t.status),
        ).length;

        const missingCount = chart.teeth.filter(
            (t) => t.status === ToothStatus.MISSING,
        ).length;

        const needsAttentionCount = chart.teeth.filter((t) =>
            [ToothStatus.DECAYED, ToothStatus.NEEDS_TREATMENT].includes(t.status),
        ).length;

        return {
            chartType: chart.chartType,
            totalTeeth: chart.teeth.length,
            healthyCount,
            treatedCount,
            missingCount,
            needsAttentionCount,
            totalTreatmentEntries: treatmentCount,
            lastUpdatedBy: chart.lastUpdatedBy,
            updatedAt: (chart as any).updatedAt,
        };
    }

    /**
     * Generate the default set of teeth with HEALTHY status.
     * Adult: teeth 1-32, Pediatric: teeth 51-70 (A-T mapped).
     */
    private generateDefaultTeeth(chartType: 'adult' | 'pediatric') {
        if (chartType === 'pediatric') {
            return Array.from({ length: 20 }, (_, i) => ({
                toothNumber: 51 + i,
                status: ToothStatus.HEALTHY,
                surfaces: [],
                conditions: [],
                notes: '',
                history: [],
            }));
        }

        return Array.from({ length: 32 }, (_, i) => ({
            toothNumber: 1 + i,
            status: ToothStatus.HEALTHY,
            surfaces: [],
            conditions: [],
            notes: '',
            history: [],
        }));
    }
}
