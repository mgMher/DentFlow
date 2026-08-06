import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';
import { CreateNotificationDto, QueryNotificationDto } from './dto';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>,
    ) {}

    async create(
        clinicId: string,
        dto: CreateNotificationDto,
    ): Promise<NotificationDocument> {
        const notification = new this.notificationModel({
            clinicId: new Types.ObjectId(clinicId),
            recipientId: new Types.ObjectId(dto.recipientId),
            type: dto.type,
            title: dto.title,
            message: dto.message,
            relatedId: dto.relatedId ? new Types.ObjectId(dto.relatedId) : undefined,
            relatedType: dto.relatedType,
        });

        return notification.save();
    }

    async findAll(
        clinicId: string,
        userId: string,
        query: QueryNotificationDto,
    ): Promise<{
        data: NotificationDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const { page, limit, isRead } = query;
        const skip = (page - 1) * limit;

        const filter: FilterQuery<NotificationDocument> = {
            clinicId: new Types.ObjectId(clinicId),
            recipientId: new Types.ObjectId(userId),
        };

        if (isRead !== undefined) {
            filter.isRead = isRead;
        }

        const [data, total] = await Promise.all([
            this.notificationModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.notificationModel.countDocuments(filter).exec(),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markAsRead(
        clinicId: string,
        notificationId: string,
    ): Promise<NotificationDocument> {
        const notification = await this.notificationModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(notificationId),
                    clinicId: new Types.ObjectId(clinicId),
                },
                { $set: { isRead: true } },
                { new: true },
            )
            .exec();

        if (!notification) {
            throw new NotFoundException(`Notification with ID "${notificationId}" not found`);
        }

        return notification;
    }

    async markAllAsRead(clinicId: string, userId: string): Promise<{ modifiedCount: number }> {
        const result = await this.notificationModel
            .updateMany(
                {
                    clinicId: new Types.ObjectId(clinicId),
                    recipientId: new Types.ObjectId(userId),
                    isRead: false,
                },
                { $set: { isRead: true } },
            )
            .exec();

        return { modifiedCount: result.modifiedCount };
    }

    async getUnreadCount(clinicId: string, userId: string): Promise<{ count: number }> {
        const count = await this.notificationModel
            .countDocuments({
                clinicId: new Types.ObjectId(clinicId),
                recipientId: new Types.ObjectId(userId),
                isRead: false,
            })
            .exec();

        return { count };
    }

    async delete(clinicId: string, notificationId: string): Promise<void> {
        const result = await this.notificationModel
            .findOneAndDelete({
                _id: new Types.ObjectId(notificationId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .exec();

        if (!result) {
            throw new NotFoundException(`Notification with ID "${notificationId}" not found`);
        }
    }
}
