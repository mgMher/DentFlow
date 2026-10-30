import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { errorBody } from 'src/common/utils';
import { User, UserDocument } from '../auth/auth.schema';
import { Notification, NotificationDocument, NotificationRelatedType, NotificationType } from './notification.schema';
import { QueryNotificationDto } from './dto';

type Id = string | Types.ObjectId;
const oid = (id: Id) => new Types.ObjectId(id.toString());

export interface NotifyInput {
    clinicId: Id;
    /** Duplicates, empty ids and the actor are dropped; inactive or other-clinic users get nothing. */
    recipients: (Id | null | undefined)[];
    actorId?: Id;
    type: NotificationType;
    data?: Record<string, unknown>;
    relatedId?: Id;
    relatedType?: NotificationRelatedType;
}

/** First and last name of a populated reference, for notification wording. */
export const personName = (ref: unknown): string | undefined => {
    const p = ref as { firstName?: string; lastName?: string } | null | undefined;
    const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
    return name || undefined;
};

/** Id of a reference whether or not it was populated. */
export const refOf = (ref: unknown): string | undefined => {
    if (!ref) return undefined;
    const id = (ref as { _id?: unknown })._id ?? ref;
    return String(id);
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
    ) {}

    // ── Creating ─────────────────────────────────────────────────────────────

    /**
     * Tell staff that something happened. Never throws: a notification that
     * can't be written is logged, and the booking or payment it is about
     * still succeeds.
     */
    async notify(input: NotifyInput): Promise<number> {
        try {
            const actor = input.actorId?.toString();
            const ids = [...new Set(input.recipients.filter(Boolean).map(String))].filter((id) => id !== actor);
            if (!ids.length) return 0;

            const recipients = await this.userModel
                .find({ _id: { $in: ids.map(oid) }, clinicId: oid(input.clinicId), isActive: true })
                .select('_id')
                .lean();
            if (!recipients.length) return 0;

            await this.notificationModel.insertMany(
                recipients.map((r) => ({
                    clinicId: oid(input.clinicId),
                    recipientId: r._id,
                    type: input.type,
                    data: input.data,
                    actorId: input.actorId ? oid(input.actorId) : undefined,
                    relatedId: input.relatedId ? oid(input.relatedId) : undefined,
                    relatedType: input.relatedType,
                })),
            );
            return recipients.length;
        } catch (err) {
            this.logger.error(`Could not create ${input.type} notifications: ${(err as Error).message}`);
            return 0;
        }
    }

    /** Active staff of the clinic with one of these roles. */
    async staffWithRoles(clinicId: Id, roles: Role[]): Promise<Types.ObjectId[]> {
        const users = await this.userModel
            .find({ clinicId: oid(clinicId), role: { $in: roles }, isActive: true })
            .select('_id')
            .lean();
        return users.map((u) => u._id as Types.ObjectId);
    }

    // ── Reading (own notifications only) ─────────────────────────────────────

    private own(clinicId: Id, userId: Id): FilterQuery<NotificationDocument> {
        return { clinicId: oid(clinicId), recipientId: oid(userId) };
    }

    async findAll(clinicId: string, userId: string, query: QueryNotificationDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = this.own(clinicId, userId);
        if (query.isRead !== undefined) filter.isRead = query.isRead;

        const [data, total, unread] = await Promise.all([
            this.notificationModel
                .find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('actorId', 'firstName lastName')
                .lean(),
            this.notificationModel.countDocuments(filter),
            this.notificationModel.countDocuments({ ...this.own(clinicId, userId), isRead: false }),
        ]);

        return { data, total, unread, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getUnreadCount(clinicId: string, userId: string): Promise<{ count: number }> {
        const count = await this.notificationModel.countDocuments({ ...this.own(clinicId, userId), isRead: false });
        return { count };
    }

    // ── Changing (own notifications only) ────────────────────────────────────

    /** Someone else's notification is "not found" — it used to be readable and deletable by anyone in the clinic. */
    async markAsRead(clinicId: string, userId: string, id: Types.ObjectId) {
        const notification = await this.notificationModel
            .findOneAndUpdate({ _id: id, ...this.own(clinicId, userId) }, { $set: { isRead: true } }, { new: true })
            .populate('actorId', 'firstName lastName')
            .lean();
        if (!notification) throw this.notFound();
        return notification;
    }

    async markAllAsRead(clinicId: string, userId: string): Promise<{ modifiedCount: number }> {
        const result = await this.notificationModel.updateMany(
            { ...this.own(clinicId, userId), isRead: false },
            { $set: { isRead: true } },
        );
        return { modifiedCount: result.modifiedCount };
    }

    async delete(clinicId: string, userId: string, id: Types.ObjectId): Promise<{ deleted: true }> {
        const result = await this.notificationModel.deleteOne({ _id: id, ...this.own(clinicId, userId) });
        if (!result.deletedCount) throw this.notFound();
        return { deleted: true };
    }

    /** Clear the read ones in one go. */
    async deleteRead(clinicId: string, userId: string): Promise<{ deletedCount: number }> {
        const result = await this.notificationModel.deleteMany({ ...this.own(clinicId, userId), isRead: true });
        return { deletedCount: result.deletedCount };
    }

    private notFound() {
        return new NotFoundException(errorBody('notificationNotFound', 'Notification not found'));
    }
}
