import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationTemplateDocument = NotificationTemplate & Document;

export enum TemplateType {
    APPOINTMENT_REMINDER = 'appointment_reminder',
    APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
    APPOINTMENT_CANCELLATION = 'appointment_cancellation',
    PAYMENT_RECEIPT = 'payment_receipt',
}

export enum TemplateChannel {
    EMAIL = 'email',
    SMS = 'sms',
}

export enum TemplateLanguage {
    HY = 'hy',
    RU = 'ru',
    EN = 'en',
}

@Schema({ timestamps: true })
export class NotificationTemplate {
    @Prop({
        type: Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true,
    })
    clinicId: Types.ObjectId;

    @Prop({
        required: true,
        enum: TemplateType,
    })
    type: TemplateType;

    @Prop({
        required: true,
        enum: TemplateChannel,
    })
    channel: TemplateChannel;

    @Prop({ trim: true })
    subject: string;

    @Prop({ required: true, trim: true })
    bodyTemplate: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({
        enum: TemplateLanguage,
        default: TemplateLanguage.HY,
    })
    language: TemplateLanguage;
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate);

NotificationTemplateSchema.index({ clinicId: 1, type: 1, channel: 1, language: 1 });
