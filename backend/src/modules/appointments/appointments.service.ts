import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, PopulateOptions, Types } from 'mongoose';
import { runOnce } from 'src/common/migrations/run-once';
import { ClinicRefsService } from 'src/common/clinic-refs';
import {
    addDays,
    clinicTimeToUtc,
    clinicToday,
    errorBody,
    toClinicDateString,
    toClinicTimeString,
    weekdayOf,
} from 'src/common/utils';
import { Appointment, AppointmentDocument, AppointmentStatus, RecurringFrequency } from './appointment.schema';
import {
    AppointmentFilterDto,
    CalendarQueryDto,
    CancelAppointmentDto,
    CreateAppointmentDto,
    CreateRecurringAppointmentDto,
    MAX_SERIES_OCCURRENCES,
    QueryAppointmentDto,
    RecurringPatternDto,
    UpdateAppointmentDto,
} from './dto';
import { PatientsService } from '../patients/patients.service';
import { UserProfile, UserProfileDocument } from '../users/user.schema';
import { ScheduleService, SLOT_HOLDING_STATUSES } from '../schedule/schedule.service';
import { NotificationsService, personName } from '../notifications/notifications.service';
import { NotificationRelatedType, NotificationType } from '../notifications/notification.schema';

type Id = string | Types.ObjectId;
const oid = (id: Id) => new Types.ObjectId(id.toString());
/** Id of a reference whether or not it was populated. */
const refId = (ref: unknown): string =>
    ref && typeof ref === 'object' && '_id' in (ref as object) ? String((ref as { _id: unknown })._id) : String(ref);

const S = AppointmentStatus;

/**
 * Allowed status changes. Cancelling goes through PATCH /:id/cancel (it needs
 * a reason). Scheduled → in progress / completed is allowed for walk-ins and
 * visits recorded afterwards.
 */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    [S.SCHEDULED]: [S.CONFIRMED, S.IN_PROGRESS, S.COMPLETED, S.NO_SHOW],
    [S.CONFIRMED]: [S.SCHEDULED, S.IN_PROGRESS, S.COMPLETED, S.NO_SHOW],
    [S.IN_PROGRESS]: [S.COMPLETED],
    [S.COMPLETED]: [],
    [S.CANCELLED]: [S.SCHEDULED],
    [S.NO_SHOW]: [S.SCHEDULED],
};

const EDITABLE_STATUSES = [S.SCHEDULED, S.CONFIRMED];
const CANCELLABLE_STATUSES = [S.SCHEDULED, S.CONFIRMED];
/** These describe something that happened, so they can't be set before the visit starts. */
const NEEDS_STARTED = [S.IN_PROGRESS, S.COMPLETED, S.NO_SHOW];
/** A patient may be seen a little early. */
const START_GRACE_MS = 30 * 60_000;
const MAX_DURATION_MS = 12 * 3_600_000;
const MAX_SERIES_DAYS = 366;
const CALENDAR_LIMIT = 2000;

/** One populate list for every response, so a status change no longer drops room and treatments. */
const POPULATE: PopulateOptions[] = [
    { path: 'patientId', select: 'firstName lastName patronymic phone email status' },
    { path: 'dentistId', select: 'firstName lastName email' },
    { path: 'treatmentRoomId', select: 'name isActive' },
    { path: 'treatmentIds', select: 'name nameHy nameRu code duration price' },
];

@Injectable()
export class AppointmentsService implements OnModuleInit {
    private readonly logger = new Logger(AppointmentsService.name);

    constructor(
        @InjectModel(Appointment.name)
        private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(UserProfile.name)
        private readonly userProfileModel: Model<UserProfileDocument>,
        private readonly patientsService: PatientsService,
        private readonly clinicRefs: ClinicRefsService,
        private readonly scheduleService: ScheduleService,
        private readonly notifications: NotificationsService,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    /**
     * Tell the dentist (or dentists) about a change someone else made to
     * their diary. The actor is never notified of their own action.
     */
    private notifyDentists(
        clinicId: string,
        type: NotificationType,
        appointment: AppointmentDocument,
        actorId: string | undefined,
        extra: Record<string, unknown> = {},
        dentistIds: string[] = [refId(appointment.dentistId)],
    ) {
        return this.notifications.notify({
            clinicId,
            recipients: dentistIds,
            actorId,
            type,
            relatedId: appointment._id,
            relatedType: NotificationRelatedType.APPOINTMENT,
            data: {
                patientName: personName(appointment.patientId),
                startTime: appointment.startTime,
                ...extra,
            },
        });
    }

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
        await runOnce(this.connection, '2026-09-appointment-dentist-repoint', this.logger, async () => {
            const dentistIds: Types.ObjectId[] =
                await this.appointmentModel.distinct('dentistId');

            if (!dentistIds.length) {
                return 0;
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
            return migrated;
        });
    }

    // ─── Create ───────────────────────────────────────────────────────

    async create(clinicId: string, dto: CreateAppointmentDto, actorId?: string): Promise<AppointmentDocument> {
        const { startTime, endTime } = this.parseRange(dto.startTime, dto.endTime);
        await this.assertRefs(clinicId, dto);
        await this.assertBookable(clinicId, {
            dentistId: dto.dentistId,
            patientId: dto.patientId,
            treatmentRoomId: dto.treatmentRoomId,
            startTime,
            endTime,
            allowOutsideHours: dto.allowOutsideHours,
        });

        const created = await this.appointmentModel.create(this.newAppointment(clinicId, dto, startTime, endTime));
        await this.assertWonRace(clinicId, created);
        const appointment = await this.findById(clinicId, created._id);
        await this.notifyDentists(clinicId, NotificationType.APPOINTMENT_CREATED, appointment, actorId);
        return appointment;
    }

    /**
     * A series of appointments, generated on the clinic's calendar (so "every
     * Monday 10:00" stays 10:00 in Yerevan). Occurrences that clash are
     * skipped and reported, not silently dropped; the series is capped.
     */
    async createRecurring(
        clinicId: string,
        dto: CreateRecurringAppointmentDto,
        actorId?: string,
    ): Promise<{ seriesId: Types.ObjectId; created: AppointmentDocument[]; skipped: { startTime: string; code: string }[] }> {
        const { startTime, endTime } = this.parseRange(dto.startTime, dto.endTime);
        await this.assertRefs(clinicId, dto);

        const tz = await this.clinicRefs.timezoneOf(clinicId);
        const occurrences = this.expandSeries(dto.recurringPattern, startTime, tz);
        const durationMs = endTime.getTime() - startTime.getTime();
        const seriesId = new Types.ObjectId();

        const created: AppointmentDocument[] = [];
        const skipped: { startTime: string; code: string }[] = [];

        for (const start of occurrences) {
            const end = new Date(start.getTime() + durationMs);
            try {
                await this.assertBookable(clinicId, {
                    dentistId: dto.dentistId,
                    patientId: dto.patientId,
                    treatmentRoomId: dto.treatmentRoomId,
                    startTime: start,
                    endTime: end,
                    allowOutsideHours: dto.allowOutsideHours,
                });
            } catch (err) {
                const code = (err as { response?: { code?: string } }).response?.code;
                if (!code) throw err;
                skipped.push({ startTime: start.toISOString(), code });
                continue;
            }

            const appointment = await this.appointmentModel.create({
                ...this.newAppointment(clinicId, dto, start, end),
                isRecurring: true,
                seriesId,
                recurringPattern: {
                    frequency: dto.recurringPattern.frequency,
                    interval: dto.recurringPattern.interval,
                    endDate: new Date(dto.recurringPattern.endDate),
                    daysOfWeek: dto.recurringPattern.daysOfWeek,
                },
            });
            created.push(appointment);
        }

        if (!created.length) {
            throw new ConflictException(
                errorBody('seriesAllConflicting', 'None of the dates in this series could be booked'),
            );
        }

        // One notification for the whole series, pointing at its first visit.
        await this.notifyDentists(
            clinicId,
            NotificationType.APPOINTMENT_CREATED,
            await this.findById(clinicId, created[0]._id),
            actorId,
            { count: created.length },
        );

        return { seriesId, created, skipped };
    }

    // ─── Read ─────────────────────────────────────────────────────────

    async findAll(clinicId: string, query: QueryAppointmentDto) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const filter = this.buildFilter(clinicId, query);

        const [appointments, total] = await Promise.all([
            this.appointmentModel
                .find(filter)
                .sort({ startTime: query.sortOrder === 'desc' ? -1 : 1, _id: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate(POPULATE)
                .lean(),
            this.appointmentModel.countDocuments(filter),
        ]);

        return {
            appointments,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Everything in a date range, for the calendar. Same shape as the list
     * (the page used to read `startTime` while this returned `start`, so the
     * calendar was empty in any month that had appointments).
     */
    async getCalendarData(clinicId: string, query: CalendarQueryDto) {
        const filter = this.buildFilter(clinicId, query);
        if (!query.status && !query.includeCancelled) {
            filter.status = { $ne: AppointmentStatus.CANCELLED };
        }
        return this.appointmentModel.find(filter).sort({ startTime: 1 }).limit(CALENDAR_LIMIT).populate(POPULATE).lean();
    }

    /** Today on the clinic's calendar (the server runs in UTC). */
    async getTodayAppointments(clinicId: string) {
        const { start, end } = clinicToday(await this.clinicRefs.timezoneOf(clinicId));
        return this.appointmentModel
            .find({ clinicId: oid(clinicId), startTime: { $gte: start, $lt: end } })
            .sort({ startTime: 1 })
            .populate(POPULATE)
            .lean();
    }

    async findById(clinicId: string, appointmentId: Id): Promise<AppointmentDocument> {
        const appointment = await this.appointmentModel
            .findOne({ _id: oid(appointmentId), clinicId: oid(clinicId) })
            .populate(POPULATE)
            .populate('cancelledBy', 'firstName lastName');

        if (!appointment) {
            throw new NotFoundException(errorBody('appointmentNotFound', 'Appointment not found'));
        }
        return appointment;
    }

    // ─── Update ───────────────────────────────────────────────────────

    /** Reschedule or edit details. Only appointments that have not happened yet can change. */
    async update(
        clinicId: string,
        appointmentId: Id,
        dto: UpdateAppointmentDto,
        actorId?: string,
    ): Promise<AppointmentDocument> {
        const existing = await this.findById(clinicId, appointmentId);

        if (!EDITABLE_STATUSES.includes(existing.status)) {
            throw new BadRequestException(
                errorBody('appointmentNotEditable', `An appointment that is ${existing.status} cannot be edited`),
            );
        }

        const { startTime, endTime } = this.parseRange(
            dto.startTime ?? existing.startTime.toISOString(),
            dto.endTime ?? existing.endTime.toISOString(),
        );
        await this.assertRefs(clinicId, dto);

        const dentistId = dto.dentistId ?? refId(existing.dentistId);
        const treatmentRoomId = dto.treatmentRoomId ?? (existing.treatmentRoomId ? refId(existing.treatmentRoomId) : undefined);
        const moved =
            startTime.getTime() !== existing.startTime.getTime() ||
            endTime.getTime() !== existing.endTime.getTime() ||
            dentistId !== refId(existing.dentistId) ||
            treatmentRoomId !== (existing.treatmentRoomId ? refId(existing.treatmentRoomId) : undefined);

        if (moved) {
            await this.assertBookable(clinicId, {
                dentistId,
                patientId: refId(existing.patientId),
                treatmentRoomId,
                startTime,
                endTime,
                excludeId: existing._id,
                allowOutsideHours: dto.allowOutsideHours,
            });
        }

        const set: Record<string, unknown> = {
            startTime,
            endTime,
            duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
            dentistId: oid(dentistId),
        };
        if (dto.treatmentRoomId !== undefined) set.treatmentRoomId = dto.treatmentRoomId ? oid(dto.treatmentRoomId) : null;
        if (dto.title !== undefined) set.title = dto.title;
        if (dto.treatmentType !== undefined) set.treatmentType = dto.treatmentType;
        if (dto.treatmentIds !== undefined) set.treatmentIds = dto.treatmentIds.map(oid);
        if (dto.notes !== undefined) set.notes = dto.notes;
        if (dto.color !== undefined) set.color = dto.color;

        await this.appointmentModel.updateOne({ _id: existing._id, clinicId: oid(clinicId) }, { $set: set });
        const updated = await this.findById(clinicId, existing._id);

        // A new time or a new dentist is news for the dentists involved; a room or note change is not.
        const previousDentist = refId(existing.dentistId);
        if (startTime.getTime() !== existing.startTime.getTime() || dentistId !== previousDentist) {
            await this.notifyDentists(
                clinicId,
                NotificationType.APPOINTMENT_RESCHEDULED,
                updated,
                actorId,
                { previousStartTime: existing.startTime, dentistChanged: dentistId !== previousDentist },
                [dentistId, previousDentist],
            );
        }
        return updated;
    }

    /**
     * Move along the allowed lifecycle (see TRANSITIONS). The endpoint used
     * to accept any string and any jump — completed back to scheduled,
     * no-show to completed. Bringing a cancelled or no-show appointment back
     * re-checks the slot, because it may have been given to someone else.
     */
    async updateStatus(
        clinicId: string,
        appointmentId: Id,
        status: AppointmentStatus,
        actorId?: string,
    ): Promise<AppointmentDocument> {
        const appointment = await this.findById(clinicId, appointmentId);
        const from = appointment.status;

        if (from === status) return appointment;

        if (status === AppointmentStatus.CANCELLED) {
            throw new BadRequestException(errorBody('useCancelEndpoint', 'Cancel an appointment with a reason instead'));
        }
        if (!TRANSITIONS[from]?.includes(status)) {
            throw new BadRequestException(
                errorBody('invalidStatusTransition', `Cannot change an appointment from ${from} to ${status}`),
            );
        }
        if (NEEDS_STARTED.includes(status) && appointment.startTime.getTime() > Date.now() + START_GRACE_MS) {
            throw new BadRequestException(
                errorBody('appointmentNotStarted', 'This appointment has not started yet'),
            );
        }

        if (status === AppointmentStatus.SCHEDULED && !SLOT_HOLDING_STATUSES.includes(from)) {
            if (appointment.startTime.getTime() < Date.now()) {
                throw new BadRequestException(errorBody('appointmentInPast', 'Book a new time instead; this one has passed'));
            }
            await this.assertBookable(clinicId, {
                dentistId: refId(appointment.dentistId),
                patientId: refId(appointment.patientId),
                treatmentRoomId: appointment.treatmentRoomId ? refId(appointment.treatmentRoomId) : undefined,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                excludeId: appointment._id,
                allowOutsideHours: true,
            });
        }

        // Conditional on the status we validated against, so two people
        // clicking different buttons at once cannot both win.
        const updated = await this.appointmentModel.updateOne(
            { _id: appointment._id, clinicId: oid(clinicId), status: from },
            {
                $set: { status },
                ...(status === AppointmentStatus.SCHEDULED
                    ? { $unset: { cancelReason: 1, cancelNote: 1, cancelledAt: 1, cancelledBy: 1 } }
                    : {}),
            },
        );
        if (!updated.modifiedCount) {
            throw new ConflictException(errorBody('appointmentChanged', 'The appointment was changed by someone else; reload'));
        }

        if (status === AppointmentStatus.COMPLETED) {
            await this.patientsService.touchLastVisit(oid(clinicId), oid(refId(appointment.patientId)), appointment.startTime);
        }

        const result = await this.findById(clinicId, appointment._id);
        if (status === AppointmentStatus.CONFIRMED) {
            await this.notifyDentists(clinicId, NotificationType.APPOINTMENT_CONFIRMED, result, actorId);
        }
        return result;
    }

    /**
     * Cancel with a structured reason. For a recurring series, `following`
     * also cancels every later open appointment of the same series.
     */
    async cancel(
        clinicId: string,
        appointmentId: Id,
        dto: CancelAppointmentDto,
        userId: string,
    ): Promise<AppointmentDocument & { cancelledCount?: number }> {
        const appointment = await this.findById(clinicId, appointmentId);

        if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
            throw new BadRequestException(
                errorBody('appointmentNotCancellable', `An appointment that is ${appointment.status} cannot be cancelled`),
            );
        }

        const filter: FilterQuery<AppointmentDocument> =
            dto.scope === 'following' && appointment.seriesId
                ? {
                      clinicId: oid(clinicId),
                      seriesId: appointment.seriesId,
                      startTime: { $gte: appointment.startTime },
                      status: { $in: CANCELLABLE_STATUSES },
                  }
                : { _id: appointment._id, clinicId: oid(clinicId), status: { $in: CANCELLABLE_STATUSES } };

        const result = await this.appointmentModel.updateMany(filter, {
            $set: {
                status: AppointmentStatus.CANCELLED,
                cancelReason: dto.reason,
                cancelNote: dto.note?.trim() || undefined,
                cancelledAt: new Date(),
                cancelledBy: oid(userId),
            },
        });

        const updated = await this.findById(clinicId, appointment._id);
        if (result.modifiedCount) {
            await this.notifyDentists(clinicId, NotificationType.APPOINTMENT_CANCELLED, updated, userId, {
                count: result.modifiedCount,
                reason: dto.reason,
            });
        }
        return Object.assign(updated.toObject(), { cancelledCount: result.modifiedCount }) as AppointmentDocument & {
            cancelledCount?: number;
        };
    }

    // ─── Rules ────────────────────────────────────────────────────────

    private parseRange(start: string, end: string): { startTime: Date; endTime: Date } {
        const startTime = new Date(start);
        const endTime = new Date(end);
        if (endTime <= startTime) {
            throw new BadRequestException(errorBody('appointmentEndBeforeStart', 'endTime must be after startTime'));
        }
        if (endTime.getTime() - startTime.getTime() > MAX_DURATION_MS) {
            throw new BadRequestException(errorBody('appointmentTooLong', 'An appointment cannot be longer than 12 hours'));
        }
        return { startTime, endTime };
    }

    /**
     * Every id in the body must belong to this clinic — otherwise a caller
     * could attach another clinic's patient or dentist and read their details
     * back through populate. Only the fields present are checked.
     */
    private async assertRefs(
        clinicId: string,
        dto: Partial<Pick<CreateAppointmentDto, 'patientId' | 'dentistId' | 'treatmentRoomId' | 'treatmentIds'>>,
    ): Promise<void> {
        await Promise.all([
            dto.patientId && this.clinicRefs.assertPatient(clinicId, dto.patientId, { forBooking: true }),
            dto.dentistId && this.clinicRefs.assertDentist(clinicId, dto.dentistId),
            dto.treatmentRoomId && this.clinicRefs.assertRoom(clinicId, dto.treatmentRoomId),
            dto.treatmentIds?.length && this.clinicRefs.assertTreatments(clinicId, dto.treatmentIds),
        ]);
    }

    /**
     * The slot must be free for the dentist, the room and the patient, and the
     * dentist must be working (not blocked, within hours unless overridden).
     * Booking used to check the dentist's other appointments only.
     */
    private async assertBookable(
        clinicId: string,
        slot: {
            dentistId: string;
            patientId: string;
            treatmentRoomId?: string;
            startTime: Date;
            endTime: Date;
            excludeId?: Id;
            allowOutsideHours?: boolean;
        },
    ): Promise<void> {
        const clash = await this.findClash(clinicId, slot);
        if (clash) throw new ConflictException(clash);

        await this.scheduleService.assertDentistAvailable(clinicId, slot.dentistId, slot.startTime, slot.endTime, {
            allowOutsideHours: slot.allowOutsideHours,
        });
    }

    /** The first overlapping appointment for the same dentist, room or patient, as an error body. */
    private async findClash(
        clinicId: string,
        slot: { dentistId: string; patientId: string; treatmentRoomId?: string; startTime: Date; endTime: Date; excludeId?: Id },
        onlyEarlierThan?: Types.ObjectId,
    ): Promise<{ code: string; message: string } | null> {
        const who: FilterQuery<AppointmentDocument>[] = [
            { dentistId: oid(slot.dentistId) },
            { patientId: oid(slot.patientId) },
        ];
        if (slot.treatmentRoomId) who.push({ treatmentRoomId: oid(slot.treatmentRoomId) });

        const ids: FilterQuery<AppointmentDocument>['_id'] = {};
        if (slot.excludeId) ids.$ne = oid(slot.excludeId);
        if (onlyEarlierThan) ids.$lt = onlyEarlierThan;

        const other = await this.appointmentModel
            .findOne({
                clinicId: oid(clinicId),
                status: { $in: SLOT_HOLDING_STATUSES },
                startTime: { $lt: slot.endTime },
                endTime: { $gt: slot.startTime },
                $or: who,
                ...(Object.keys(ids).length ? { _id: ids } : {}),
            })
            .select('dentistId patientId treatmentRoomId')
            .lean();

        if (!other) return null;
        if (other.dentistId?.toString() === slot.dentistId) {
            return errorBody('appointmentConflictDentist', 'The dentist already has an appointment at this time');
        }
        if (slot.treatmentRoomId && other.treatmentRoomId?.toString() === slot.treatmentRoomId) {
            return errorBody('appointmentConflictRoom', 'The room is already booked at this time');
        }
        return errorBody('appointmentConflictPatient', 'The patient already has an appointment at this time');
    }

    /**
     * Two requests for the same slot can both pass the check before either is
     * saved. After saving, the later document (higher _id) yields to an
     * earlier one that overlaps, so exactly one booking survives.
     */
    private async assertWonRace(clinicId: string, created: AppointmentDocument): Promise<void> {
        const clash = await this.findClash(
            clinicId,
            {
                dentistId: refId(created.dentistId),
                patientId: refId(created.patientId),
                treatmentRoomId: created.treatmentRoomId ? refId(created.treatmentRoomId) : undefined,
                startTime: created.startTime,
                endTime: created.endTime,
                excludeId: created._id,
            },
            created._id,
        );
        if (clash) {
            await this.appointmentModel.deleteOne({ _id: created._id });
            throw new ConflictException(clash);
        }
    }

    private newAppointment(clinicId: string, dto: CreateAppointmentDto, startTime: Date, endTime: Date) {
        return {
            clinicId: oid(clinicId),
            patientId: oid(dto.patientId),
            dentistId: oid(dto.dentistId),
            treatmentRoomId: dto.treatmentRoomId ? oid(dto.treatmentRoomId) : undefined,
            title: dto.title?.trim() || undefined,
            startTime,
            endTime,
            duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
            status: AppointmentStatus.SCHEDULED,
            treatmentType: dto.treatmentType,
            treatmentIds: dto.treatmentIds?.map(oid),
            notes: dto.notes,
            color: dto.color,
            isRecurring: false,
        };
    }

    private buildFilter(clinicId: string, query: AppointmentFilterDto): FilterQuery<AppointmentDocument> {
        const filter: FilterQuery<AppointmentDocument> = { clinicId: oid(clinicId) };
        if (query.startDate) filter.endTime = { $gt: new Date(query.startDate) };
        if (query.endDate) filter.startTime = { $lt: new Date(query.endDate) };
        if (query.dentistId) filter.dentistId = oid(query.dentistId);
        if (query.patientId) filter.patientId = oid(query.patientId);
        if (query.status) filter.status = query.status;
        return filter;
    }

    /**
     * Occurrence start instants for a series, computed on the clinic's
     * calendar: same wall-clock time every time, months clamped to their last
     * day (Jan 31 → Feb 28, not Mar 3).
     */
    private expandSeries(pattern: RecurringPatternDto, first: Date, tz: string): Date[] {
        const firstDate = toClinicDateString(first, tz);
        const time = toClinicTimeString(first, tz);
        const lastDate = pattern.endDate.slice(0, 10);

        if (lastDate < firstDate) {
            throw new BadRequestException(errorBody('seriesEndBeforeStart', 'The series must end after its first appointment'));
        }
        if (lastDate > addDays(firstDate, MAX_SERIES_DAYS)) {
            throw new BadRequestException(errorBody('seriesTooLong', 'A series can run for at most one year'));
        }

        const dates: string[] = [];
        const push = (d: string) => d >= firstDate && d <= lastDate && dates.length < MAX_SERIES_OCCURRENCES && dates.push(d);

        if (pattern.frequency === RecurringFrequency.DAILY) {
            for (let d = firstDate; d <= lastDate && dates.length < MAX_SERIES_OCCURRENCES; d = addDays(d, pattern.interval)) push(d);
        } else if (pattern.frequency === RecurringFrequency.WEEKLY) {
            const days = pattern.daysOfWeek?.length ? [...pattern.daysOfWeek].sort() : [weekdayOf(firstDate)];
            const weekStart = addDays(firstDate, -weekdayOf(firstDate));
            for (let w = weekStart; w <= lastDate && dates.length < MAX_SERIES_OCCURRENCES; w = addDays(w, 7 * pattern.interval)) {
                for (const day of days) push(addDays(w, day));
            }
        } else {
            const [y, m, d] = firstDate.split('-').map(Number);
            for (let i = 0; dates.length < MAX_SERIES_OCCURRENCES; i += pattern.interval) {
                const monthIndex = m - 1 + i;
                const year = y + Math.floor(monthIndex / 12);
                const month = (monthIndex % 12) + 1;
                const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
                const date = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
                if (date > lastDate) break;
                push(date);
            }
        }

        return dates.map((date) => clinicTimeToUtc(date, time, tz));
    }
}
