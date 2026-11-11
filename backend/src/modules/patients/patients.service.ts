import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Connection, FilterQuery, Model, Types, UpdateQuery } from 'mongoose';
import { runOnce } from 'src/common/migrations/run-once';
import {
    Patient,
    PatientDocument,
    PatientStatus,
    PatientStatusChange,
} from './patient.schema';
import { ARMENIAN_PHONE_E164, errorBody, escapeRegex, normalizeArmenianPhone } from 'src/common/utils';
import { CreatePatientDto, DuplicatePatientQueryDto, QueryPatientDto, UpdatePatientDto } from './dto';
import { ClinicRefsService, UpcomingAppointmentsService } from 'src/common/clinic-refs';
import { clinicMonth } from 'src/common/utils';

export interface PaginatedPatients {
    data: PatientDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

import { patientSearchClauses } from './patient-search';

@Injectable()
export class PatientsService implements OnModuleInit {
    private readonly logger = new Logger(PatientsService.name);

    constructor(
        @InjectModel(Patient.name)
        private readonly patientModel: Model<PatientDocument>,
        @InjectConnection() private readonly connection: Connection,
        private readonly clinicRefs: ClinicRefsService,
        private readonly upcoming: UpcomingAppointmentsService,
    ) {}

    /** One-off data fixes; each runs once per database (see `runOnce`). */
    async onModuleInit(): Promise<void> {
        await runOnce(this.connection, '2026-09-patient-status-backfill', this.logger, () => this.backfillStatus());
        await runOnce(this.connection, '2026-10-patient-phone-normalize', this.logger, () => this.normalizeStoredPhones());
        await runOnce(this.connection, '2026-10-patient-email-not-unique', this.logger, () => this.dropUniqueEmailIndex());
        // The schema kept declaring the index, so autoIndex built it again on
        // any database the first run found without it (every fresh install).
        await runOnce(this.connection, '2026-10-patient-email-not-unique-again', this.logger, () => this.dropUniqueEmailIndex());
    }

    /**
     * Families register several patients (children) under one parent's email,
     * so the per-clinic unique index on email is dropped; the create form warns
     * about matches instead. A schema change alone never drops an index.
     */
    private async dropUniqueEmailIndex(): Promise<number> {
        const indexes = await this.patientModel.collection.indexes();
        if (!indexes.some((i) => i.name === 'clinicId_1_email_1_unique')) return 0;
        await this.patientModel.collection.dropIndex('clinicId_1_email_1_unique');
        this.logger.log('Dropped unique index on patient email');
        return 1;
    }

    /** `status` for patients created before the field existed. */
    private async backfillStatus(): Promise<number> {
        const [activated, deactivated] = await Promise.all([
            this.patientModel.updateMany(
                { status: { $exists: false }, isActive: { $ne: false } },
                { $set: { status: PatientStatus.ACTIVE } },
            ),
            this.patientModel.updateMany(
                { status: { $exists: false }, isActive: false },
                { $set: { status: PatientStatus.INACTIVE } },
            ),
        ]);
        const migrated = activated.modifiedCount + deactivated.modifiedCount;
        if (migrated) this.logger.log(`Backfilled status for ${migrated} patient(s)`);
        return migrated;
    }

    /**
     * Phones (patient and emergency contact) entered before validation existed
     * are in whatever format was typed. Rewrite those that map cleanly onto
     * +374XXXXXXXX; list the rest by id only — phone numbers are personal data
     * and do not belong in logs.
     */
    private async normalizeStoredPhones(): Promise<number> {
        const notCanonical = { $exists: true, $nin: [null, ''], $not: ARMENIAN_PHONE_E164 };
        const patients = await this.patientModel
            .find({ $or: [{ phone: notCanonical }, { 'emergencyContact.phone': notCanonical }] }, { phone: 1, emergencyContact: 1 })
            .lean();

        const updates: AnyBulkWriteOperation<PatientDocument>[] = [];
        const unparseable: string[] = [];

        for (const patient of patients) {
            const set: Record<string, string> = {};
            for (const [path, value] of [
                ['phone', patient.phone],
                ['emergencyContact.phone', patient.emergencyContact?.phone],
            ] as const) {
                if (!value || ARMENIAN_PHONE_E164.test(value)) continue;
                const normalized = normalizeArmenianPhone(value);
                if (typeof normalized === 'string' && ARMENIAN_PHONE_E164.test(normalized)) set[path] = normalized;
                else unparseable.push(`${patient._id} (${path})`);
            }
            if (Object.keys(set).length) {
                updates.push({ updateOne: { filter: { _id: patient._id }, update: { $set: set } } });
            }
        }

        if (updates.length) {
            await this.patientModel.bulkWrite(updates, { ordered: false });
            this.logger.log(`Normalized phone numbers on ${updates.length} patient(s) to +374XXXXXXXX`);
        }
        if (unparseable.length) {
            this.logger.warn(
                `${unparseable.length} phone number(s) need fixing by hand: ${unparseable.slice(0, 20).join(', ')}${unparseable.length > 20 ? ', …' : ''}`,
            );
        }
        return updates.length;
    }

    async create(
        clinicId: Types.ObjectId,
        dto: CreatePatientDto,
        userId?: Types.ObjectId,
    ): Promise<PatientDocument> {
        this.assertValidDateOfBirth(dto.dateOfBirth);

        // On create, `null` just means "not provided" — don't persist empty values.
        const source = dto as unknown as Record<string, unknown>;
        const fields: Record<string, unknown> = {};
        Object.keys(source).forEach((key) => {
            const value = source[key];
            if (value !== null && value !== undefined) {
                fields[key] = value;
            }
        });

        const patient = new this.patientModel({
            ...fields,
            clinicId,
            status: PatientStatus.ACTIVE,
            isActive: true,
            statusHistory: [{ to: PatientStatus.ACTIVE, changedBy: userId, changedAt: new Date() }],
        });
        return patient.save();
    }

    async findAll(clinicId: Types.ObjectId, query: QueryPatientDto): Promise<PaginatedPatients> {
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 20;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<PatientDocument> = { clinicId };

        if (query.search?.trim()) {
            filter.$and = patientSearchClauses(query.search);
        }

        if (query.gender) {
            filter.gender = query.gender;
        }

        if (query.status) {
            filter.status = query.status;
        } else if (query.isActive !== undefined) {
            filter.isActive = query.isActive;
        }

        const sortField = query.sortBy || 'lastName';
        const sortDirection = query.sortOrder === 'desc' ? -1 : 1;
        // `_id` last: without a unique tie-breaker, rows with equal values (e.g. no
        // last visit yet) could appear on two pages or on none.
        const sort: Record<string, 1 | -1> =
            sortField === 'lastName'
                ? { lastName: sortDirection, firstName: sortDirection, _id: 1 }
                : { [sortField]: sortDirection, _id: 1 };

        const [data, total] = await Promise.all([
            this.patientModel
                .find(filter)
                .select('-statusHistory')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec(),
            this.patientModel.countDocuments(filter).exec(),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }

    async findById(clinicId: Types.ObjectId, patientId: Types.ObjectId): Promise<PatientDocument> {
        const patient = await this.patientModel
            .findOne({ _id: patientId, clinicId })
            .populate('statusHistory.changedBy', 'firstName lastName')
            .exec();

        if (!patient) {
            throw new NotFoundException(
                errorBody('patientNotFound', `Patient with ID "${patientId}" not found`),
            );
        }

        return patient;
    }

    async update(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        dto: UpdatePatientDto,
        userId?: Types.ObjectId,
    ): Promise<PatientDocument> {
        if (dto.dateOfBirth) {
            this.assertValidDateOfBirth(dto.dateOfBirth);
        }

        const set: Record<string, unknown> = {};
        const unset: Record<string, ''> = {};

        // An explicit `null` means "clear this field"; a key that is absent (or
        // `undefined`) means "leave it untouched". This applies to every
        // optional field, so clearing patronymic, the emergency contact or the
        // insurance block in the UI actually removes it.
        const source = dto as unknown as Record<string, unknown>;
        Object.keys(source).forEach((key) => {
            const value = source[key];
            if (value === null) {
                unset[key] = '';
            } else if (value !== undefined) {
                set[key] = value;
            }
        });

        const updateQuery: UpdateQuery<PatientDocument> = {};
        if (Object.keys(set).length) updateQuery.$set = set;
        if (Object.keys(unset).length) updateQuery.$unset = unset;

        if (!Object.keys(updateQuery).length) {
            return this.findById(clinicId, patientId);
        }

        const patient = await this.patientModel
            .findOneAndUpdate({ _id: patientId, clinicId }, updateQuery, { new: true, runValidators: true })
            .populate('statusHistory.changedBy', 'firstName lastName')
            .exec();

        if (!patient) {
            throw new NotFoundException(
                errorBody('patientNotFound', `Patient with ID "${patientId}" not found`),
            );
        }

        return patient;
    }

    /**
     * Move a patient between lifecycle statuses (active / inactive / archived /
     * deceased). `isActive` is kept in sync for the reports that still read it.
     *
     * The update is conditional on the status we read, so two people changing
     * it at once cannot both write a history entry with the same `from`.
     * Optionally cancels the patient's upcoming appointments.
     */
    async updateStatus(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        status: PatientStatus,
        userId?: Types.ObjectId,
        reason?: string,
        cancelUpcomingAppointments = false,
    ): Promise<PatientDocument & { cancelledAppointments?: number }> {
        const current = await this.patientModel.findOne({ _id: patientId, clinicId }, { status: 1 }).lean();

        if (!current) {
            throw new NotFoundException(errorBody('patientNotFound', `Patient with ID "${patientId}" not found`));
        }

        // Re-selecting the same status is a no-op, not an audit event.
        if (current.status === status) {
            return this.findById(clinicId, patientId);
        }

        const patient = await this.patientModel
            .findOneAndUpdate(
                { _id: patientId, clinicId, status: current.status },
                {
                    $set: { status, isActive: status === PatientStatus.ACTIVE },
                    $push: {
                        statusHistory: {
                            from: current.status,
                            to: status,
                            reason: reason?.trim() || undefined,
                            changedBy: userId,
                            changedAt: new Date(),
                        } as PatientStatusChange,
                    },
                },
                { new: true },
            )
            .populate('statusHistory.changedBy', 'firstName lastName')
            .exec();

        if (!patient) {
            throw new ConflictException(
                errorBody('patientStatusChanged', 'The status was changed by someone else; reload and try again'),
            );
        }

        let cancelledAppointments: number | undefined;
        if (cancelUpcomingAppointments && status !== PatientStatus.ACTIVE) {
            cancelledAppointments = await this.upcoming.cancel(clinicId, { patientId }, `Patient ${status}`, userId);
        }

        return Object.assign(patient.toObject(), { cancelledAppointments }) as PatientDocument & {
            cancelledAppointments?: number;
        };
    }

    /** How many booked appointments are still ahead for this patient (for the status dialog). */
    async countUpcomingAppointments(clinicId: Types.ObjectId, patientId: Types.ObjectId): Promise<{ count: number }> {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        return { count: await this.upcoming.count(clinicId, { patientId }) };
    }

    /**
     * Patients who are probably the same person: same name and date of birth,
     * or the same phone, or the same email. Exact matches on the server — the
     * old client-side check searched 50 last-name substrings and missed real
     * duplicates whenever the surname was common.
     */
    async findPossibleDuplicates(clinicId: Types.ObjectId, query: DuplicatePatientQueryDto) {
        const exact = (value: string) => new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
        const or: FilterQuery<PatientDocument>[] = [];

        if (query.firstName?.trim() && query.lastName?.trim() && query.dateOfBirth) {
            const day = new Date(query.dateOfBirth);
            if (!Number.isNaN(day.getTime())) {
                // Dates of birth are stored as UTC midnight of the calendar day.
                const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
                or.push({
                    firstName: exact(query.firstName),
                    lastName: exact(query.lastName),
                    dateOfBirth: { $gte: start, $lt: new Date(start.getTime() + 86_400_000) },
                });
            }
        }
        if (query.phone && ARMENIAN_PHONE_E164.test(query.phone)) or.push({ phone: query.phone });
        if (query.email?.trim()) or.push({ email: query.email.trim().toLowerCase() });

        if (!or.length) return [];

        const filter: FilterQuery<PatientDocument> = { clinicId, $or: or };
        if (query.excludeId && Types.ObjectId.isValid(query.excludeId)) {
            filter._id = { $ne: new Types.ObjectId(query.excludeId) };
        }

        return this.patientModel
            .find(filter)
            .select('firstName lastName patronymic dateOfBirth phone email status')
            .limit(5)
            .lean();
    }

    /** Records a completed visit so the patients list can show "last visit". */
    async touchLastVisit(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        visitedAt: Date = new Date(),
    ): Promise<void> {
        await this.patientModel
            .updateOne(
                { _id: patientId, clinicId },
                { $max: { lastVisit: visitedAt } },
            )
            .exec();
    }

    async getPatientStats(clinicId: Types.ObjectId): Promise<{
        totalPatients: number;
        activePatients: number;
        inactivePatients: number;
        newPatientsThisMonth: number;
        byStatus: Record<string, number>;
    }> {
        // "This month" on the clinic's calendar, not the server's (UTC).
        const { start: startOfMonth } = clinicMonth(await this.clinicRefs.timezoneOf(clinicId));

        const [totalPatients, newPatientsThisMonth, grouped] = await Promise.all([
            this.patientModel.countDocuments({ clinicId }).exec(),
            this.patientModel
                .countDocuments({ clinicId, createdAt: { $gte: startOfMonth } })
                .exec(),
            this.patientModel
                .aggregate<{ _id: string | null; count: number }>([
                    // Aggregations are not cast by the schema: the JWT gives a string.
                    { $match: { clinicId: new Types.ObjectId(clinicId.toString()) } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ])
                .exec(),
        ]);

        const byStatus = Object.values(PatientStatus).reduce<Record<string, number>>(
            (acc, status) => ({ ...acc, [status]: 0 }),
            {},
        );

        grouped.forEach(({ _id, count }) => {
            // Documents created before `status` existed count as active.
            const key = _id && _id in byStatus ? _id : PatientStatus.ACTIVE;
            byStatus[key] += count;
        });

        return {
            totalPatients,
            activePatients: byStatus[PatientStatus.ACTIVE],
            inactivePatients: totalPatients - byStatus[PatientStatus.ACTIVE],
            newPatientsThisMonth,
            byStatus,
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private assertValidDateOfBirth(dateOfBirth: string): void {
        const date = new Date(dateOfBirth);

        if (Number.isNaN(date.getTime())) {
            throw new BadRequestException(
                errorBody('invalidDateOfBirth', 'dateOfBirth is not a valid date'),
            );
        }
        if (date.getTime() > Date.now()) {
            throw new BadRequestException(
                errorBody('futureDateOfBirth', 'dateOfBirth cannot be in the future'),
            );
        }
        if (date.getFullYear() < 1900) {
            throw new BadRequestException(
                errorBody('dateOfBirthTooOld', 'dateOfBirth must be after 1900'),
            );
        }
    }
}
