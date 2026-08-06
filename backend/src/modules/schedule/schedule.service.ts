import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TreatmentRoom, TreatmentRoomDocument } from './treatment-room.schema';
import { BlockedTime, BlockedTimeDocument } from './blocked-time.schema';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../appointments/appointment.schema';
import { UserProfile, UserProfileDocument } from '../users/user.schema';
import { CreateRoomDto, UpdateRoomDto, CreateBlockedTimeDto } from './dto';

export interface TimeSlot {
    start: string;
    end: string;
}

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
    ) {}

    // ─── Treatment Rooms ──────────────────────────────────────────────

    async getRooms(clinicId: string): Promise<TreatmentRoomDocument[]> {
        return this.roomModel
            .find({ clinicId: new Types.ObjectId(clinicId) })
            .sort({ name: 1 })
            .exec();
    }

    async createRoom(clinicId: string, dto: CreateRoomDto): Promise<TreatmentRoomDocument> {
        const room = new this.roomModel({
            clinicId: new Types.ObjectId(clinicId),
            name: dto.name,
            description: dto.description,
            equipment: dto.equipment || [],
        });
        return room.save();
    }

    async updateRoom(
        clinicId: string,
        roomId: string,
        dto: UpdateRoomDto,
    ): Promise<TreatmentRoomDocument> {
        const room = await this.roomModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(roomId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                { $set: dto },
                { new: true, runValidators: true },
            )
            .exec();

        if (!room) {
            throw new NotFoundException(`Treatment room with ID "${roomId}" not found`);
        }

        return room;
    }

    async deactivateRoom(clinicId: string, roomId: string): Promise<TreatmentRoomDocument> {
        const room = await this.roomModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(roomId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                { $set: { isActive: false } },
                { new: true },
            )
            .exec();

        if (!room) {
            throw new NotFoundException(`Treatment room with ID "${roomId}" not found`);
        }

        return room;
    }

    // ─── Blocked Times ────────────────────────────────────────────────

    async getBlockedTimes(
        clinicId: string,
        dentistId?: string,
        startDate?: string,
        endDate?: string,
    ): Promise<BlockedTimeDocument[]> {
        const filter: FilterQuery<BlockedTimeDocument> = {
            clinicId: new Types.ObjectId(clinicId),
        };

        if (dentistId) {
            filter.dentistId = new Types.ObjectId(dentistId);
        }

        if (startDate || endDate) {
            filter.startTime = {};
            if (startDate) {
                filter.startTime.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.startTime.$lte = new Date(endDate);
            }
        }

        return this.blockedTimeModel
            .find(filter)
            .sort({ startTime: 1 })
            .populate('dentistId', 'firstName lastName email')
            .exec();
    }

    async createBlockedTime(
        clinicId: string,
        dto: CreateBlockedTimeDto,
    ): Promise<BlockedTimeDocument> {
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);

        if (endTime <= startTime) {
            throw new BadRequestException('endTime must be after startTime');
        }

        const blockedTime = new this.blockedTimeModel({
            clinicId: new Types.ObjectId(clinicId),
            dentistId: new Types.ObjectId(dto.dentistId),
            startTime,
            endTime,
            reason: dto.reason,
            title: dto.title,
            isRecurring: dto.isRecurring || false,
        });

        return blockedTime.save();
    }

    async deleteBlockedTime(clinicId: string, blockedTimeId: string): Promise<void> {
        const result = await this.blockedTimeModel
            .findOneAndDelete({
                _id: new Types.ObjectId(blockedTimeId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .exec();

        if (!result) {
            throw new NotFoundException(`Blocked time with ID "${blockedTimeId}" not found`);
        }
    }

    // ─── Dentist Availability ─────────────────────────────────────────

    async getDentistAvailability(
        clinicId: string,
        dentistId: string,
        date: string,
    ): Promise<TimeSlot[]> {
        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();

        // Get dentist profile with schedule
        const dentist = await this.userProfileModel
            .findOne({
                clinicId: new Types.ObjectId(clinicId),
                _id: new Types.ObjectId(dentistId),
                isActive: true,
            })
            .exec();

        if (!dentist) {
            throw new NotFoundException(`Dentist with ID "${dentistId}" not found`);
        }

        // Find working hours for the given day of week
        const dayAvailability = dentist.schedule?.defaultAvailability?.find(
            (avail) => avail.dayOfWeek === dayOfWeek,
        );

        if (!dayAvailability) {
            return []; // Dentist does not work on this day
        }

        // Parse working hours into Date objects for the target date
        const [startHour, startMin] = dayAvailability.startTime.split(':').map(Number);
        const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);

        const workStart = new Date(targetDate);
        workStart.setHours(startHour, startMin, 0, 0);

        const workEnd = new Date(targetDate);
        workEnd.setHours(endHour, endMin, 0, 0);

        // Get start and end of the target date for queries
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Get blocked times and appointments for the dentist on this date
        const [blockedTimes, appointments] = await Promise.all([
            this.blockedTimeModel
                .find({
                    clinicId: new Types.ObjectId(clinicId),
                    dentistId: new Types.ObjectId(dentistId),
                    startTime: { $lt: dayEnd },
                    endTime: { $gt: dayStart },
                })
                .sort({ startTime: 1 })
                .lean(),
            this.appointmentModel
                .find({
                    clinicId: new Types.ObjectId(clinicId),
                    dentistId: new Types.ObjectId(dentistId),
                    startTime: { $lt: dayEnd },
                    endTime: { $gt: dayStart },
                    status: {
                        $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
                    },
                })
                .sort({ startTime: 1 })
                .lean(),
        ]);

        // Merge blocked times and appointments into a single sorted list of busy intervals
        const busyIntervals: { start: Date; end: Date }[] = [];

        for (const bt of blockedTimes) {
            busyIntervals.push({
                start: new Date(Math.max(bt.startTime.getTime(), workStart.getTime())),
                end: new Date(Math.min(bt.endTime.getTime(), workEnd.getTime())),
            });
        }

        for (const appt of appointments) {
            busyIntervals.push({
                start: new Date(Math.max(appt.startTime.getTime(), workStart.getTime())),
                end: new Date(Math.min(appt.endTime.getTime(), workEnd.getTime())),
            });
        }

        // Sort by start time
        busyIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Merge overlapping intervals
        const merged: { start: Date; end: Date }[] = [];
        for (const interval of busyIntervals) {
            if (merged.length === 0 || merged[merged.length - 1].end < interval.start) {
                merged.push({ ...interval });
            } else {
                merged[merged.length - 1].end = new Date(
                    Math.max(merged[merged.length - 1].end.getTime(), interval.end.getTime()),
                );
            }
        }

        // Compute free slots from working hours minus merged busy intervals
        const freeSlots: TimeSlot[] = [];
        let cursor = workStart;

        for (const busy of merged) {
            if (cursor < busy.start) {
                freeSlots.push({
                    start: cursor.toISOString(),
                    end: busy.start.toISOString(),
                });
            }
            if (busy.end > cursor) {
                cursor = busy.end;
            }
        }

        if (cursor < workEnd) {
            freeSlots.push({
                start: cursor.toISOString(),
                end: workEnd.toISOString(),
            });
        }

        return freeSlots;
    }
}
