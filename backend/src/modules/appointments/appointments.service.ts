import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
    Appointment,
    AppointmentDocument,
    AppointmentStatus,
} from './appointment.schema';
import { CreateAppointmentDto, QueryAppointmentDto, UpdateAppointmentDto } from './dto';
import { PatientsService } from '../patients/patients.service';
import { UserProfile, UserProfileDocument } from '../users/user.schema';

@Injectable()
export class AppointmentsService implements OnModuleInit {
    private readonly logger = new Logger(AppointmentsService.name);

    constructor(
        @InjectModel(Appointment.name)
        private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(UserProfile.name)
        private readonly userProfileModel: Model<UserProfileDocument>,
        private readonly patientsService: PatientsService,
    ) {}

    /**
     * `Appointment.dentistId` references the auth `User` collection, but the UI
     * used to send the dentist's `UserProfile` id, which resolves to nothing on
     * populate (so the dentist showed as "-"). Convert those rows to the
     * matching `authId`.
     *
     * Safe and idempotent: ObjectIds are unique across collections, so a stored
     * value that matches a `UserProfile._id` can only be a profile id, and once
     * rewritten to an `authId` it no longer matches anything here.
     */
    async onModuleInit(): Promise<void> {
        try {
            const dentistIds: Types.ObjectId[] =
                await this.appointmentModel.distinct('dentistId');

            if (!dentistIds.length) {
                return;
            }

            const profiles = await this.userProfileModel
                .find({ _id: { $in: dentistIds } }, { _id: 1, authId: 1 })
                .lean();

            let migrated = 0;

            for (const profile of profiles) {
                if (!profile.authId) {
                    this.logger.warn(
                        `UserProfile ${profile._id} has no authId; appointments referencing it were left unchanged`,
                    );
                    continue;
                }

                const result = await this.appointmentModel
                    .updateMany(
                        { dentistId: profile._id },
                        { $set: { dentistId: profile.authId } },
                    )
                    .exec();

                migrated += result.modifiedCount;
            }

            if (migrated) {
                this.logger.log(
                    `Repointed dentistId on ${migrated} appointment(s) from UserProfile to auth User`,
                );
            }
        } catch (err) {
            this.logger.warn(
                `Could not migrate appointment dentist references: ${(err as Error).message}`,
            );
        }
    }

    /**
     * Create a new appointment after checking for scheduling conflicts.
     */
    async create(clinicId: string, dto: CreateAppointmentDto): Promise<AppointmentDocument> {
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);

        if (endTime <= startTime) {
            throw new BadRequestException('endTime must be after startTime');
        }

        const conflict = await this.checkConflict(
            clinicId,
            dto.dentistId,
            startTime,
            endTime,
        );

        if (conflict) {
            throw new ConflictException(
                'Dentist already has an appointment during this time slot',
            );
        }

        const duration = dto.duration || Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        const appointment = await this.appointmentModel.create({
            clinicId: new Types.ObjectId(clinicId),
            patientId: new Types.ObjectId(dto.patientId),
            dentistId: new Types.ObjectId(dto.dentistId),
            treatmentRoomId: dto.treatmentRoomId
                ? new Types.ObjectId(dto.treatmentRoomId)
                : undefined,
            title: dto.title,
            startTime,
            endTime,
            duration,
            status: dto.status || AppointmentStatus.SCHEDULED,
            treatmentType: dto.treatmentType,
            treatmentIds: dto.treatmentIds?.map((id) => new Types.ObjectId(id)),
            notes: dto.notes,
            isRecurring: dto.isRecurring || false,
            recurringPattern: dto.recurringPattern
                ? {
                      frequency: dto.recurringPattern.frequency,
                      interval: dto.recurringPattern.interval,
                      endDate: new Date(dto.recurringPattern.endDate),
                      daysOfWeek: dto.recurringPattern.daysOfWeek,
                  }
                : undefined,
            color: dto.color,
        });

        return appointment;
    }

    /**
     * Find all appointments for a clinic with pagination and optional filters.
     */
    async findAll(clinicId: string, query: QueryAppointmentDto) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<AppointmentDocument> = {
            clinicId: new Types.ObjectId(clinicId),
        };

        if (query.startDate) {
            filter.startTime = { ...filter.startTime, $gte: new Date(query.startDate) };
        }
        if (query.endDate) {
            filter.startTime = { ...filter.startTime, $lte: new Date(query.endDate) };
        }
        if (query.dentistId) {
            filter.dentistId = new Types.ObjectId(query.dentistId);
        }
        if (query.patientId) {
            filter.patientId = new Types.ObjectId(query.patientId);
        }
        if (query.status) {
            filter.status = query.status;
        }

        const [appointments, total] = await Promise.all([
            this.appointmentModel
                .find(filter)
                .sort({ startTime: 1 })
                .skip(skip)
                .limit(limit)
                .populate('patientId', 'firstName lastName phone')
                .populate('dentistId', 'firstName lastName email')
                .populate('treatmentRoomId', 'name')
                .lean(),
            this.appointmentModel.countDocuments(filter),
        ]);

        return {
            appointments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find a single appointment by ID, scoped to a clinic.
     */
    async findById(clinicId: string, appointmentId: string): Promise<AppointmentDocument> {
        const appointment = await this.appointmentModel
            .findOne({
                _id: new Types.ObjectId(appointmentId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .populate('patientId', 'firstName lastName phone email')
            .populate('dentistId', 'firstName lastName email')
            .populate('treatmentRoomId', 'name')
            .populate('treatmentIds');

        if (!appointment) {
            throw new NotFoundException('Appointment not found');
        }

        return appointment;
    }

    /**
     * Update an appointment. If start/end times change, re-check for conflicts.
     */
    async update(
        clinicId: string,
        appointmentId: string,
        dto: UpdateAppointmentDto,
    ): Promise<AppointmentDocument> {
        const existing = await this.findById(clinicId, appointmentId);

        if (
            existing.status === AppointmentStatus.CANCELLED ||
            existing.status === AppointmentStatus.COMPLETED
        ) {
            throw new BadRequestException(
                `Cannot update an appointment with status "${existing.status}"`,
            );
        }

        const startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
        const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

        if (endTime <= startTime) {
            throw new BadRequestException('endTime must be after startTime');
        }

        const dentistId = dto.dentistId || existing.dentistId.toString();
        const isRescheduled =
            dto.startTime || dto.endTime || dto.dentistId;

        if (isRescheduled) {
            const conflict = await this.checkConflict(
                clinicId,
                dentistId,
                startTime,
                endTime,
                appointmentId,
            );

            if (conflict) {
                throw new ConflictException(
                    'Dentist already has an appointment during this time slot',
                );
            }
        }

        const updateData: Record<string, any> = {};

        if (dto.patientId) updateData.patientId = new Types.ObjectId(dto.patientId);
        if (dto.dentistId) updateData.dentistId = new Types.ObjectId(dto.dentistId);
        if (dto.treatmentRoomId !== undefined) {
            updateData.treatmentRoomId = dto.treatmentRoomId
                ? new Types.ObjectId(dto.treatmentRoomId)
                : null;
        }
        if (dto.title !== undefined) updateData.title = dto.title;
        if (dto.startTime) updateData.startTime = startTime;
        if (dto.endTime) updateData.endTime = endTime;
        if (dto.startTime || dto.endTime) {
            updateData.duration =
                dto.duration || Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        } else if (dto.duration !== undefined) {
            updateData.duration = dto.duration;
        }
        if (dto.status) updateData.status = dto.status;
        if (dto.treatmentType !== undefined) updateData.treatmentType = dto.treatmentType;
        if (dto.treatmentIds) {
            updateData.treatmentIds = dto.treatmentIds.map((id) => new Types.ObjectId(id));
        }
        if (dto.notes !== undefined) updateData.notes = dto.notes;
        if (dto.isRecurring !== undefined) updateData.isRecurring = dto.isRecurring;
        if (dto.recurringPattern !== undefined) {
            updateData.recurringPattern = dto.recurringPattern
                ? {
                      frequency: dto.recurringPattern.frequency,
                      interval: dto.recurringPattern.interval,
                      endDate: new Date(dto.recurringPattern.endDate),
                      daysOfWeek: dto.recurringPattern.daysOfWeek,
                  }
                : null;
        }
        if (dto.color !== undefined) updateData.color = dto.color;

        const updated = await this.appointmentModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(appointmentId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                { $set: updateData },
                { new: true },
            )
            .populate('patientId', 'firstName lastName phone email')
            .populate('dentistId', 'firstName lastName email')
            .populate('treatmentRoomId', 'name');

        if (!updated) {
            throw new NotFoundException('Appointment not found');
        }

        if (dto.status === AppointmentStatus.COMPLETED) {
            await this.recordVisit(clinicId, updated);
        }

        return updated;
    }

    /**
     * Cancel an appointment with an optional reason.
     */
    async cancel(
        clinicId: string,
        appointmentId: string,
        reason?: string,
    ): Promise<AppointmentDocument> {
        const appointment = await this.findById(clinicId, appointmentId);

        if (appointment.status === AppointmentStatus.CANCELLED) {
            throw new BadRequestException('Appointment is already cancelled');
        }
        if (appointment.status === AppointmentStatus.COMPLETED) {
            throw new BadRequestException('Cannot cancel a completed appointment');
        }

        const updated = await this.appointmentModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(appointmentId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                {
                    $set: {
                        status: AppointmentStatus.CANCELLED,
                        cancelReason: reason || '',
                    },
                },
                { new: true },
            )
            .populate('patientId', 'firstName lastName phone email')
            .populate('dentistId', 'firstName lastName email');

        return updated;
    }

    /**
     * Update only the status of an appointment.
     */
    async updateStatus(
        clinicId: string,
        appointmentId: string,
        status: AppointmentStatus,
    ): Promise<AppointmentDocument> {
        const appointment = await this.findById(clinicId, appointmentId);

        if (appointment.status === AppointmentStatus.CANCELLED) {
            throw new BadRequestException('Cannot change status of a cancelled appointment');
        }

        const updated = await this.appointmentModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(appointmentId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                { $set: { status } },
                { new: true },
            )
            .populate('patientId', 'firstName lastName phone email')
            .populate('dentistId', 'firstName lastName email');

        if (!updated) {
            throw new NotFoundException('Appointment not found');
        }

        if (status === AppointmentStatus.COMPLETED) {
            await this.recordVisit(clinicId, updated);
        }

        return updated;
    }

    /**
     * Stamp the patient's `lastVisit` when an appointment is completed, so the
     * patients list reflects real visit dates.
     */
    private async recordVisit(
        clinicId: string,
        appointment: AppointmentDocument,
    ): Promise<void> {
        const patientId =
            appointment.patientId && typeof appointment.patientId === 'object'
                ? (appointment.patientId as any)._id || appointment.patientId
                : appointment.patientId;

        await this.patientsService.touchLastVisit(
            new Types.ObjectId(clinicId),
            new Types.ObjectId(String(patientId)),
            appointment.startTime,
        );
    }

    /**
     * Get appointments formatted for calendar view within a date range.
     * Optionally filter by dentist.
     */
    async getCalendarData(
        clinicId: string,
        startDate: string,
        endDate: string,
        dentistId?: string,
    ) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new BadRequestException('Invalid startDate or endDate');
        }

        const filter: FilterQuery<AppointmentDocument> = {
            clinicId: new Types.ObjectId(clinicId),
            startTime: { $gte: start },
            endTime: { $lte: end },
            status: { $ne: AppointmentStatus.CANCELLED },
        };

        if (dentistId) {
            filter.dentistId = new Types.ObjectId(dentistId);
        }

        const appointments = await this.appointmentModel
            .find(filter)
            .sort({ startTime: 1 })
            .populate('patientId', 'firstName lastName')
            .populate('dentistId', 'firstName lastName')
            .populate('treatmentRoomId', 'name')
            .lean();

        return appointments.map((appt) => ({
            _id: appt._id,
            title: appt.title,
            start: appt.startTime,
            end: appt.endTime,
            duration: appt.duration,
            status: appt.status,
            color: appt.color,
            treatmentType: appt.treatmentType,
            patient: appt.patientId,
            dentist: appt.dentistId,
            treatmentRoom: appt.treatmentRoomId,
        }));
    }

    /**
     * Get all appointments for today, scoped to a clinic.
     */
    async getTodayAppointments(clinicId: string) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const appointments = await this.appointmentModel
            .find({
                clinicId: new Types.ObjectId(clinicId),
                startTime: { $gte: startOfDay, $lte: endOfDay },
            })
            .sort({ startTime: 1 })
            .populate('patientId', 'firstName lastName phone')
            .populate('dentistId', 'firstName lastName')
            .populate('treatmentRoomId', 'name')
            .lean();

        return appointments;
    }

    /**
     * Check whether a dentist has a conflicting appointment in the given time range.
     * Optionally exclude a specific appointment (for updates/reschedules).
     * Returns true if a conflict exists.
     */
    async checkConflict(
        clinicId: string,
        dentistId: string,
        startTime: Date,
        endTime: Date,
        excludeId?: string,
    ): Promise<boolean> {
        const filter: FilterQuery<AppointmentDocument> = {
            clinicId: new Types.ObjectId(clinicId),
            dentistId: new Types.ObjectId(dentistId),
            status: { $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
            $or: [
                // New appointment starts during an existing one
                { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
            ],
        };

        if (excludeId) {
            filter._id = { $ne: new Types.ObjectId(excludeId) };
        }

        const conflicting = await this.appointmentModel.findOne(filter).lean();
        return !!conflicting;
    }

    /**
     * Create a series of recurring appointments based on the recurring pattern.
     * Returns all created appointments.
     */
    async createRecurring(
        clinicId: string,
        dto: CreateAppointmentDto,
    ): Promise<AppointmentDocument[]> {
        if (!dto.recurringPattern) {
            throw new BadRequestException('recurringPattern is required for recurring appointments');
        }

        const { frequency, interval, endDate, daysOfWeek } = dto.recurringPattern;
        const seriesEndDate = new Date(endDate);
        const baseStartTime = new Date(dto.startTime);
        const baseEndTime = new Date(dto.endTime);
        const durationMs = baseEndTime.getTime() - baseStartTime.getTime();

        if (durationMs <= 0) {
            throw new BadRequestException('endTime must be after startTime');
        }

        const dates: { start: Date; end: Date }[] = [];
        let currentDate = new Date(baseStartTime);

        while (currentDate <= seriesEndDate) {
            if (frequency === 'weekly' && daysOfWeek?.length) {
                // For weekly with specific days, find matching days in the current week
                const weekStart = new Date(currentDate);
                for (const dayOfWeek of daysOfWeek) {
                    const target = new Date(weekStart);
                    const diff = dayOfWeek - target.getDay();
                    target.setDate(target.getDate() + diff);
                    target.setHours(
                        baseStartTime.getHours(),
                        baseStartTime.getMinutes(),
                        baseStartTime.getSeconds(),
                        baseStartTime.getMilliseconds(),
                    );

                    if (target >= baseStartTime && target <= seriesEndDate) {
                        const targetEnd = new Date(target.getTime() + durationMs);
                        dates.push({ start: new Date(target), end: targetEnd });
                    }
                }
                // Advance by interval weeks
                currentDate.setDate(currentDate.getDate() + 7 * interval);
            } else {
                const slotEnd = new Date(currentDate.getTime() + durationMs);
                dates.push({ start: new Date(currentDate), end: slotEnd });

                // Advance by the appropriate interval
                switch (frequency) {
                    case 'daily':
                        currentDate.setDate(currentDate.getDate() + interval);
                        break;
                    case 'weekly':
                        currentDate.setDate(currentDate.getDate() + 7 * interval);
                        break;
                    case 'monthly':
                        currentDate.setMonth(currentDate.getMonth() + interval);
                        break;
                }
            }
        }

        // Deduplicate dates by start time
        const uniqueDates = dates.filter(
            (date, index, self) =>
                index === self.findIndex((d) => d.start.getTime() === date.start.getTime()),
        );

        // Sort chronologically
        uniqueDates.sort((a, b) => a.start.getTime() - b.start.getTime());

        const created: AppointmentDocument[] = [];
        const conflicts: string[] = [];

        for (const { start, end } of uniqueDates) {
            const hasConflict = await this.checkConflict(
                clinicId,
                dto.dentistId,
                start,
                end,
            );

            if (hasConflict) {
                conflicts.push(start.toISOString());
                continue;
            }

            const appointment = await this.appointmentModel.create({
                clinicId: new Types.ObjectId(clinicId),
                patientId: new Types.ObjectId(dto.patientId),
                dentistId: new Types.ObjectId(dto.dentistId),
                treatmentRoomId: dto.treatmentRoomId
                    ? new Types.ObjectId(dto.treatmentRoomId)
                    : undefined,
                title: dto.title,
                startTime: start,
                endTime: end,
                duration: dto.duration || Math.round(durationMs / 60000),
                status: AppointmentStatus.SCHEDULED,
                treatmentType: dto.treatmentType,
                treatmentIds: dto.treatmentIds?.map((id) => new Types.ObjectId(id)),
                notes: dto.notes,
                isRecurring: true,
                recurringPattern: {
                    frequency,
                    interval,
                    endDate: seriesEndDate,
                    daysOfWeek,
                },
                color: dto.color,
            });

            created.push(appointment);
        }

        return created;
    }
}
