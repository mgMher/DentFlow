import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types, UpdateQuery } from 'mongoose';
import {
    Patient,
    PatientDocument,
    PatientStatus,
    PatientStatusChange,
} from './patient.schema';
import { ARMENIAN_PHONE_E164, normalizeArmenianPhone } from 'src/common/utils';
import { CreatePatientDto, QueryPatientDto, UpdatePatientDto } from './dto';

/**
 * Errors carry a stable `code` next to the message so the UI can translate
 * them; the message stays as the developer-facing fallback.
 */
const errorBody = (code: string, message: string) => ({ code, message });

/** Escapes a user-supplied search term so it can be used inside a RegExp. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface PaginatedPatients {
    data: PatientDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class PatientsService implements OnModuleInit {
    private readonly logger = new Logger(PatientsService.name);

    constructor(
        @InjectModel(Patient.name)
        private readonly patientModel: Model<PatientDocument>,
    ) {}

    /**
     * Backfill `status` for patients created before the field existed, so that
     * filtering and reporting by status covers every document. Idempotent.
     */
    async onModuleInit(): Promise<void> {
        try {
            const [activated, deactivated] = await Promise.all([
                this.patientModel
                    .updateMany(
                        { status: { $exists: false }, isActive: { $ne: false } },
                        { $set: { status: PatientStatus.ACTIVE } },
                    )
                    .exec(),
                this.patientModel
                    .updateMany(
                        { status: { $exists: false }, isActive: false },
                        { $set: { status: PatientStatus.INACTIVE } },
                    )
                    .exec(),
            ]);

            const migrated = activated.modifiedCount + deactivated.modifiedCount;
            if (migrated) {
                this.logger.log(`Backfilled status for ${migrated} patient(s)`);
            }
        } catch (err) {
            this.logger.warn(`Could not backfill patient status: ${(err as Error).message}`);
        }

        await this.normalizeStoredPhones();
    }

    /**
     * Phones entered before validation existed are stored in whatever format
     * was typed. Rewrite the ones that map cleanly onto +374XXXXXXXX and report
     * the rest, which need a human decision. Idempotent.
     */
    private async normalizeStoredPhones(): Promise<void> {
        try {
            const patients = await this.patientModel
                .find(
                    { phone: { $exists: true, $ne: null, $not: ARMENIAN_PHONE_E164 } },
                    { _id: 1, phone: 1, emergencyContact: 1 },
                )
                .lean();

            if (!patients.length) {
                return;
            }

            let fixed = 0;
            const unparseable: string[] = [];

            for (const patient of patients) {
                const normalized = normalizeArmenianPhone(patient.phone);

                if (typeof normalized === 'string' && ARMENIAN_PHONE_E164.test(normalized)) {
                    await this.patientModel
                        .updateOne({ _id: patient._id }, { $set: { phone: normalized } })
                        .exec();
                    fixed += 1;
                } else {
                    unparseable.push(`${patient._id}: "${patient.phone}"`);
                }
            }

            if (fixed) {
                this.logger.log(`Normalized ${fixed} patient phone number(s) to +374XXXXXXXX`);
            }
            if (unparseable.length) {
                this.logger.warn(
                    `${unparseable.length} patient phone(s) could not be normalized and need manual fixing: ${unparseable
                        .slice(0, 10)
                        .join(', ')}${unparseable.length > 10 ? ', ...' : ''}`,
                );
            }
        } catch (err) {
            this.logger.warn(`Could not normalize patient phones: ${(err as Error).message}`);
        }
    }

    async create(
        clinicId: Types.ObjectId,
        dto: CreatePatientDto,
        userId?: Types.ObjectId,
    ): Promise<PatientDocument> {
        this.assertValidDateOfBirth(dto.dateOfBirth);
        await this.assertEmailIsFree(clinicId, dto.email);

        // On create, `null` just means "not provided" — don't persist empty values.
        const source = dto as unknown as Record<string, unknown>;
        const fields: Record<string, unknown> = {};
        Object.keys(source).forEach((key) => {
            const value = source[key];
            if (value !== null && value !== undefined) {
                fields[key] = value;
            }
        });

        try {
            const patient = new this.patientModel({
                ...fields,
                clinicId,
                status: PatientStatus.ACTIVE,
                isActive: true,
                statusHistory: [
                    {
                        to: PatientStatus.ACTIVE,
                        changedBy: userId,
                        changedAt: new Date(),
                    },
                ],
            });
            return await patient.save();
        } catch (err) {
            throw this.translateDuplicateKey(err, dto.email);
        }
    }

    async findAll(clinicId: Types.ObjectId, query: QueryPatientDto): Promise<PaginatedPatients> {
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 20;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<PatientDocument> = { clinicId };

        if (query.search) {
            const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
            const digits = query.search.replace(/\D/g, '');

            filter.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { patronymic: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
            ];

            // Let "093 12 34 56" or "93123456" match the stored +374XXXXXXXX form.
            if (digits.length >= 3) {
                filter.$or.push({ phone: new RegExp(`${digits.replace(/^(?:374|0)/, '')}`, 'i') });
            }
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
        const sort: Record<string, 1 | -1> =
            sortField === 'lastName'
                ? { lastName: sortDirection, firstName: sortDirection }
                : { [sortField]: sortDirection };

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

        if (dto.email) {
            await this.assertEmailIsFree(clinicId, dto.email, patientId);
        }

        const { status, isActive, ...fields } = dto;
        const set: Record<string, unknown> = {};
        const unset: Record<string, ''> = {};

        // An explicit `null` means "clear this field"; a key that is absent (or
        // `undefined`) means "leave it untouched". This applies to every
        // optional field, so clearing patronymic, the emergency contact or the
        // insurance block in the UI actually removes it.
        const source = fields as unknown as Record<string, unknown>;
        Object.keys(source).forEach((key) => {
            const value = source[key];
            if (value === null) {
                unset[key] = '';
            } else if (value !== undefined) {
                set[key] = value;
            }
        });

        // The edit form can change status too, so that path must be audited
        // as well. Read the current value only when a status was actually sent.
        const resolvedStatus = this.resolveStatus(status, isActive);
        let statusEntry: PatientStatusChange | undefined;

        if (resolvedStatus) {
            const current = await this.patientModel
                .findOne({ _id: patientId, clinicId }, { status: 1 })
                .lean();

            if (!current) {
                throw new NotFoundException(
                    errorBody('patientNotFound', `Patient with ID "${patientId}" not found`),
                );
            }

            if (current.status !== resolvedStatus) {
                set.status = resolvedStatus;
                set.isActive = resolvedStatus === PatientStatus.ACTIVE;
                statusEntry = {
                    from: current.status,
                    to: resolvedStatus,
                    changedBy: userId,
                    changedAt: new Date(),
                } as PatientStatusChange;
            }
        }

        const updateQuery: UpdateQuery<PatientDocument> = {};
        if (Object.keys(set).length) updateQuery.$set = set;
        if (Object.keys(unset).length) updateQuery.$unset = unset;
        if (statusEntry) updateQuery.$push = { statusHistory: statusEntry };

        if (!Object.keys(updateQuery).length) {
            return this.findById(clinicId, patientId);
        }

        let patient: PatientDocument | null;
        try {
            patient = await this.patientModel
                .findOneAndUpdate({ _id: patientId, clinicId }, updateQuery, {
                    new: true,
                    runValidators: true,
                })
                .populate('statusHistory.changedBy', 'firstName lastName')
                .exec();
        } catch (err) {
            throw this.translateDuplicateKey(err, dto.email);
        }

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
     */
    async updateStatus(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        status: PatientStatus,
        userId?: Types.ObjectId,
        reason?: string,
    ): Promise<PatientDocument> {
        const current = await this.patientModel
            .findOne({ _id: patientId, clinicId }, { status: 1 })
            .lean();

        if (!current) {
            throw new NotFoundException(
                errorBody('patientNotFound', `Patient with ID "${patientId}" not found`),
            );
        }

        // Re-selecting the same status is a no-op, not an audit event.
        if (current.status === status) {
            return this.findById(clinicId, patientId);
        }

        const update: UpdateQuery<PatientDocument> = {
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
        };

        const patient = await this.patientModel
            .findOneAndUpdate({ _id: patientId, clinicId }, update, { new: true })
            .populate('statusHistory.changedBy', 'firstName lastName')
            .exec();

        if (!patient) {
            throw new NotFoundException(
                errorBody('patientNotFound', `Patient with ID "${patientId}" not found`),
            );
        }

        return patient;
    }

    async deactivate(
        clinicId: Types.ObjectId,
        patientId: Types.ObjectId,
        userId?: Types.ObjectId,
    ): Promise<PatientDocument> {
        return this.updateStatus(clinicId, patientId, PatientStatus.INACTIVE, userId);
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
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalPatients, newPatientsThisMonth, grouped] = await Promise.all([
            this.patientModel.countDocuments({ clinicId }).exec(),
            this.patientModel
                .countDocuments({ clinicId, createdAt: { $gte: startOfMonth } })
                .exec(),
            this.patientModel
                .aggregate<{ _id: string | null; count: number }>([
                    { $match: { clinicId } },
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

    private resolveStatus(
        status?: PatientStatus,
        isActive?: boolean,
    ): PatientStatus | undefined {
        if (status) {
            return status;
        }
        if (isActive === undefined) {
            return undefined;
        }
        return isActive ? PatientStatus.ACTIVE : PatientStatus.INACTIVE;
    }

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

    private async assertEmailIsFree(
        clinicId: Types.ObjectId,
        email: string | null | undefined,
        excludePatientId?: Types.ObjectId,
    ): Promise<void> {
        if (!email) {
            return;
        }

        const filter: FilterQuery<PatientDocument> = {
            clinicId,
            email: email.trim().toLowerCase(),
        };

        if (excludePatientId) {
            filter._id = { $ne: excludePatientId };
        }

        const existing = await this.patientModel.exists(filter).exec();

        if (existing) {
            throw new ConflictException(
                errorBody('patientEmailTaken', `A patient with email "${email}" already exists`),
            );
        }
    }

    /** Turns the unique-index violation into a 409 instead of a 500. */
    private translateDuplicateKey(err: unknown, email?: string | null): unknown {
        if ((err as { code?: number })?.code === 11000) {
            return new ConflictException(
                errorBody(
                    'patientEmailTaken',
                    email
                        ? `A patient with email "${email}" already exists`
                        : 'A patient with these details already exists',
                ),
            );
        }
        return err;
    }
}
