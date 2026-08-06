import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
    APPOINTMENT_REMINDER = 'appointment_reminder',
    APPOINTMENT_CANCELLED = 'appointment_cancelled',
    APPOINTMENT_CONFIRMED = 'appointment_confirmed',
    NEW_PATIENT = 'new_patient',
    PAYMENT_RECEIVED = 'payment_received',
    SYSTEM = 'system',
    CUSTOM = 'custom',
}

@Schema({ timestamps: true })
export class Notification {
    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    recipientId: Types.ObjectId;

    @Prop({
        required: true,
        enum: NotificationType,
    })
    type: NotificationType;

    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ required: true, trim: true })
    message: string;

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ type: Types.ObjectId })
    relatedId: Types.ObjectId;

    @Prop({ trim: true })
    relatedType: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ clinicId: 1, recipientId: 1, isRead: 1 });
NotificationSchema.index({ clinicId: 1, recipientId: 1, createdAt: -1 });
