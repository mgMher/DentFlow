import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
    APPOINTMENT_CREATED = 'appointment_created',
    APPOINTMENT_RESCHEDULED = 'appointment_rescheduled',
    APPOINTMENT_REMINDER = 'appointment_reminder',
    APPOINTMENT_CANCELLED = 'appointment_cancelled',
    APPOINTMENT_CONFIRMED = 'appointment_confirmed',
    /** Booked appointments cancelled because the dentist was deactivated. */
    DENTIST_APPOINTMENTS_CANCELLED = 'dentist_appointments_cancelled',
    NEW_PATIENT = 'new_patient',
    PAYMENT_RECEIVED = 'payment_received',
    PAYMENT_REFUNDED = 'payment_refunded',
    SYSTEM = 'system',
    CUSTOM = 'custom',
}

export enum NotificationRelatedType {
    APPOINTMENT = 'appointment',
    INVOICE = 'invoice',
    PATIENT = 'patient',
    STAFF = 'staff',
}

/** Notifications are a feed, not a record: they are removed after this many days. */
export const NOTIFICATION_RETENTION_DAYS = 180;

@Schema({ timestamps: true })
export class Notification {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
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

    /**
     * Free text, for `system` / `custom` and older notifications. Typed
     * notifications carry `data` instead and are worded in the reader's
     * language by the app.
     */
    @Prop({ trim: true })
    title: string;

    @Prop({ trim: true })
    message: string;

    /** Values for the wording: patient name, start time, amount, count, … */
    @Prop({ type: MongooseSchema.Types.Mixed })
    data: Record<string, unknown>;

    /** Who did what this notification is about. */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    actorId: Types.ObjectId;

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ type: MongooseSchema.Types.ObjectId })
    relatedId: Types.ObjectId;

    @Prop({ trim: true })
    relatedType: string;

    createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ clinicId: 1, recipientId: 1, isRead: 1 });
NotificationSchema.index({ clinicId: 1, recipientId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_RETENTION_DAYS * 86_400 });
