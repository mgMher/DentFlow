import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DentalRecord, DentalRecordDocument, ToothStatus } from './dental-record.schema';
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

        const toothIndex = chart.teeth.findIndex(
            (t) => t.toothNumber === dto.toothNumber,
        );

        if (toothIndex === -1) {
            throw new NotFoundException(
                `Tooth number ${dto.toothNumber} not found in chart`,
            );
        }

        if (dto.status !== undefined) {
            chart.teeth[toothIndex].status = dto.status;
        }
        if (dto.surfaces !== undefined) {
            chart.teeth[toothIndex].surfaces = dto.surfaces;
        }
        if (dto.conditions !== undefined) {
            chart.teeth[toothIndex].conditions = dto.conditions;
        }
        if (dto.notes !== undefined) {
            chart.teeth[toothIndex].notes = dto.notes;
        }

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
        const chart = await this.getOrCreateChart(clinicId, patientId);

        for (const dto of teeth) {
            const toothIndex = chart.teeth.findIndex(
                (t) => t.toothNumber === dto.toothNumber,
            );

            if (toothIndex === -1) {
                throw new NotFoundException(
                    `Tooth number ${dto.toothNumber} not found in chart`,
                );
            }

            if (dto.status !== undefined) {
                chart.teeth[toothIndex].status = dto.status;
            }
            if (dto.surfaces !== undefined) {
                chart.teeth[toothIndex].surfaces = dto.surfaces;
            }
            if (dto.conditions !== undefined) {
                chart.teeth[toothIndex].conditions = dto.conditions;
            }
            if (dto.notes !== undefined) {
                chart.teeth[toothIndex].notes = dto.notes;
            }
        }

        chart.lastUpdatedBy = userId;

        return chart.save();
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
        const entry = await this.treatmentEntryModel.create({
            clinicId,
            patientId,
            dentistId,
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
            date: new Date(),
        });

        return entry;
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

        if (query.toothNumber) {
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
            }));
        }

        return Array.from({ length: 32 }, (_, i) => ({
            toothNumber: 1 + i,
            status: ToothStatus.HEALTHY,
            surfaces: [],
            conditions: [],
            notes: '',
        }));
    }
}
