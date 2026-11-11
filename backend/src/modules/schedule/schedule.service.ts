import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { clinicDateSpan, clinicTimeToUtc, errorBody, escapeRegex, toClinicDateString, weekdayOf } from 'src/common/utils';
import { TreatmentRoom, TreatmentRoomDocument } from './treatment-room.schema';
import { BlockedTime, BlockedTimeDocument } from './blocked-time.schema';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../appointments/appointment.schema';
import { UserProfile, UserProfileDocument } from '../users/user.schema';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import { CreateRoomDto, UpdateRoomDto, CreateBlockedTimeDto } from './dto';

export interface TimeSlot {
    start: string;
    end: string;
}

interface Interval {
    start: Date;
    end: Date;
}

interface Actor {
    userId: string;
    role: string;
}

type Id = string | Types.ObjectId;
const oid = (id: Id) => new Types.ObjectId(id.toString());

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Appointments that occupy their slot. Cancelled and no-show ones free it. */
export const SLOT_HOLDING_STATUSES = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.COMPLETED,
];

/** Who may block any dentist's time. Dentists may block only their own. */
const BLOCK_ANYONE = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.RECEPTIONIST];

@Injectable()
export class ScheduleService {
    constructor(
        @InjectModel(TreatmentRoom.name)
        private readonly roomModel: Model<TreatmentRoomDocument>,
        @InjectModel(BlockedTime.name)
        private readonly blockedTimeModel: Model<BlockedTimeDocument>,
        @InjectModel(Appointment.name)
        private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(UserProfile.name)
        private readonly userProfileModel: Model<UserProfileDocument>,
        @InjectModel(Clinic.name)
        private readonly clinicModel: Model<ClinicDocument>,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    // ─── Treatment Rooms ──────────────────────────────────────────────

    async getRooms(clinicId: string): Promise<TreatmentRoomDocument[]> {
        return this.roomModel.find({ clinicId: oid(clinicId) }).sort({ name: 1 }).exec();
    }

    async createRoom(clinicId: string, dto: CreateRoomDto): Promise<TreatmentRoomDocument> {
        await this.assertRoomNameFree(clinicId, dto.name);
        return new this.roomModel({
            clinicId: oid(clinicId),
            name: dto.name.trim(),
            description: dto.description,
            equipment: dto.equipment || [],
        }).save();
    }

    async updateRoom(clinicId: string, roomId: Id, dto: UpdateRoomDto): Promise<TreatmentRoomDocument> {
        if (dto.name !== undefined) await this.assertRoomNameFree(clinicId, dto.name, roomId);

        const room = await this.roomModel
            .findOneAndUpdate(
                { _id: oid(roomId), clinicId: oid(clinicId) },
                { $set: { ...dto, ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) } },
                { new: true, runValidators: true },
            )
            .exec();

        if (!room) throw new NotFoundException(errorBody('roomNotFound', 'Treatment room not found'));
        return room;
    }

    async deactivateRoom(clinicId: string, roomId: Id): Promise<TreatmentRoomDocument> {
        return this.updateRoom(clinicId, roomId, { isActive: false });
    }

    /** Two rooms with one name make the booking dropdown ambiguous. */
    private async assertRoomNameFree(clinicId: string, name: string, excludeId?: Id): Promise<void> {
        const taken = await this.roomModel.exists({
            clinicId: oid(clinicId),
            name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
            ...(excludeId ? { _id: { $ne: oid(excludeId) } } : {}),
        });
        if (taken) throw new ConflictException(errorBody('roomNameTaken', 'A room with this name already exists'));
    }

    // ─── Blocked Times ────────────────────────────────────────────────

    /**
     * Blocks that overlap `[startDate, endDate]` (clinic calendar days). A
     * vacation that began before the range is included — filtering on the
     * start alone used to hide it. Without a range: from today on.
     */
    async getBlockedTimes(
        clinicId: string,
        dentistId?: string,
        startDate?: string,
        endDate?: string,
    ): Promise<BlockedTimeDocument[]> {
        const tz = await this.clinicRefs.timezoneOf(clinicId);
        const filter: FilterQuery<BlockedTimeDocument> = { clinicId: oid(clinicId) };

        if (dentistId) {
            if (!Types.ObjectId.isValid(dentistId)) throw new BadRequestException(errorBody('invalidId', 'Invalid dentistId'));
            filter.dentistId = oid(dentistId);
        }

        const from = startDate ?? toClinicDateString(new Date(), tz);
        for (const d of [from, endDate]) {
            if (d && !DATE_RE.test(d)) throw new BadRequestException(errorBody('validationFailed', 'Dates must be YYYY-MM-DD'));
        }
        const { start, end } = clinicDateSpan(from, endDate, tz);
        if (start) filter.endTime = { $gt: start };
        if (end) filter.startTime = { $lt: end };

        return this.blockedTimeModel
            .find(filter)
            .sort({ startTime: 1 })
            .limit(500)
            .populate('dentistId', 'firstName lastName email')
            .exec();
    }

    /**
     * Block a dentist's time. Returns how many booked appointments fall inside
     * the block, so the UI can warn — blocking used to hide that silently.
     */
    async createBlockedTime(
        clinicId: string,
        dto: CreateBlockedTimeDto,
        actor: Actor,
    ): Promise<{ blockedTime: BlockedTimeDocument; overlappingAppointments: number }> {
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);

        if (endTime <= startTime) {
            throw new BadRequestException(errorBody('availabilityEndBeforeStart', 'endTime must be after startTime'));
        }

        const dentist = await this.findDentistProfile(clinicId, dto.dentistId);
        const dentistRefId = dentist.authId || dentist._id;
        this.assertMayBlock(actor, dentistRefId);

        const blockedTime = await new this.blockedTimeModel({
            clinicId: oid(clinicId),
            dentistId: dentistRefId,
            startTime,
            endTime,
            reason: dto.reason,
            title: dto.title,
            isRecurring: false,
        }).save();

        const overlappingAppointments = await this.appointmentModel.countDocuments({
            clinicId: oid(clinicId),
            dentistId: dentistRefId,
            status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
            startTime: { $lt: endTime },
            endTime: { $gt: startTime },
        });

        return { blockedTime, overlappingAppointments };
    }

    async deleteBlockedTime(clinicId: string, blockedTimeId: Id, actor: Actor): Promise<void> {
        const blocked = await this.blockedTimeModel
            .findOne({ _id: oid(blockedTimeId), clinicId: oid(clinicId) })
            .select('dentistId')
            .lean();
        if (!blocked) throw new NotFoundException(errorBody('notFound', 'Blocked time not found'));

        this.assertMayBlock(actor, blocked.dentistId);
        await this.blockedTimeModel.deleteOne({ _id: blocked._id });
    }

    private assertMayBlock(actor: Actor, dentistRefId: Id) {
        const ownTime = actor.role === Role.DENTIST && dentistRefId.toString() === actor.userId;
        if (!BLOCK_ANYONE.includes(actor.role as Role) && !ownTime) {
            throw new ForbiddenException(
                errorBody('blockOwnTimeOnly', 'You can only block or unblock your own time'),
            );
        }
    }

    // ─── Booking rules (used by appointments) ─────────────────────────

    /**
     * The dentist's working window on clinic calendar day `date`: their own
     * weekly hours, falling back to the clinic's opening hours for members
     * without any. `null` means no hours are configured at all (no limit);
     * `'off'` means not working that day.
     */
    async workingWindow(clinicId: string, dentistRefId: Id, date: string): Promise<Interval | null | 'off'> {
        const [profile, clinic, tz] = await Promise.all([
            this.userProfileModel
                .findOne({ clinicId: oid(clinicId), $or: [{ authId: oid(dentistRefId) }, { _id: oid(dentistRefId) }] })
                .select('schedule')
                .lean(),
            this.clinicModel.findById(oid(clinicId)).select('workingHours').lean(),
            this.clinicRefs.timezoneOf(clinicId),
        ]);

        const weekday = weekdayOf(date);
        const own = profile?.schedule?.defaultAvailability ?? [];
        const clinicHours = (clinic?.workingHours ?? []).filter((h) => h.isOpen !== false);

        const source = own.length ? own : clinicHours;
        if (!source.length) return null;

        const day = source.find((h) => h.dayOfWeek === weekday);
        if (!day || day.endTime <= day.startTime) return 'off';

        return {
            start: clinicTimeToUtc(date, day.startTime, tz),
            end: clinicTimeToUtc(date, day.endTime, tz),
        };
    }

    /**
     * Throws when the dentist cannot take `[start, end)`: inside one of their
     * blocked times, or — unless `allowOutsideHours` — outside their working
     * hours. Booking used to ignore both.
     */
    async assertDentistAvailable(
        clinicId: string,
        dentistRefId: Id,
        start: Date,
        end: Date,
        opts: { allowOutsideHours?: boolean } = {},
    ): Promise<void> {
        const blocked = await this.blockedTimeModel.exists({
            clinicId: oid(clinicId),
            dentistId: oid(dentistRefId),
            startTime: { $lt: end },
            endTime: { $gt: start },
        });
        if (blocked) {
            throw new ConflictException(errorBody('appointmentInBlockedTime', 'The dentist is unavailable (blocked time) then'));
        }

        if (opts.allowOutsideHours) return;

        const tz = await this.clinicRefs.timezoneOf(clinicId);
        const date = toClinicDateString(start, tz);
        const window = await this.workingWindow(clinicId, dentistRefId, date);
        if (window === null) return;

        const inside =
            window !== 'off' &&
            toClinicDateString(new Date(end.getTime() - 1), tz) === date &&
            start >= window.start &&
            end <= window.end;
        if (!inside) {
            throw new ConflictException(
                errorBody('appointmentOutsideHours', "The time is outside the dentist's working hours"),
            );
        }
    }

    // ─── Dentist Availability ─────────────────────────────────────────

    /** Free slots for a dentist on clinic calendar day `date` (`YYYY-MM-DD`). */
    async getDentistAvailability(clinicId: string, dentistId: Id, date: string): Promise<TimeSlot[]> {
        if (!date || !DATE_RE.test(date)) {
            throw new BadRequestException(errorBody('validationFailed', 'date must be YYYY-MM-DD'));
        }

        const dentist = await this.findDentistProfile(clinicId, dentistId);
        const dentistRefId = dentist.authId || dentist._id;

        const window = await this.workingWindow(clinicId, dentistRefId, date);
        if (!window || window === 'off') return [];

        const overlapping = { startTime: { $lt: window.end }, endTime: { $gt: window.start } };
        const [blockedTimes, appointments] = await Promise.all([
            this.blockedTimeModel.find({ clinicId: oid(clinicId), dentistId: dentistRefId, ...overlapping }).lean(),
            this.appointmentModel
                .find({
                    clinicId: oid(clinicId),
                    dentistId: dentistRefId,
                    status: { $in: SLOT_HOLDING_STATUSES },
                    ...overlapping,
                })
                .lean(),
        ]);

        // Clamp to the working window and drop what ends up empty — an
        // after-hours booking used to produce a "free" slot past closing time.
        const busy: Interval[] = [...blockedTimes, ...appointments]
            .map((b) => ({
                start: new Date(Math.max(b.startTime.getTime(), window.start.getTime())),
                end: new Date(Math.min(b.endTime.getTime(), window.end.getTime())),
            }))
            .filter((b) => b.end > b.start)
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        const free: TimeSlot[] = [];
        let cursor = window.start;
        for (const b of busy) {
            if (b.start > cursor) free.push({ start: cursor.toISOString(), end: b.start.toISOString() });
            if (b.end > cursor) cursor = b.end;
        }
        if (cursor < window.end) free.push({ start: cursor.toISOString(), end: window.end.toISOString() });
        return free;
    }

    /** `dentistId` may be the auth User id (as stored on appointments) or, for older links, the profile id. */
    private async findDentistProfile(clinicId: string, dentistId: Id): Promise<UserProfileDocument> {
        const dentist = await this.userProfileModel
            .findOne({
                clinicId: oid(clinicId),
                role: Role.DENTIST,
                isActive: true,
                $or: [{ authId: oid(dentistId) }, { _id: oid(dentistId) }],
            })
            .exec();
        if (!dentist) throw new NotFoundException(errorBody('dentistNotFound', 'Dentist not found or inactive'));
        return dentist;
    }
}
