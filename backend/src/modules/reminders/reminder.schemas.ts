import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum SmsProvider {
    OFF = 'off',
    TWILIO = 'twilio',
    /** Writes the message to the delivery log instead of sending it (testing, or before a contract). */
    LOG = 'log',
}

export enum ReminderRule {
    DAY_BEFORE = 'day_before',
    HOURS_BEFORE = 'hours_before',
}

export enum ReminderStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    SKIPPED = 'skipped',
}

export enum ReminderChannel {
    TELEGRAM = 'telegram',
    SMS = 'sms',
    LOG = 'log',
}

export type ReminderSettingsDocument = ReminderSettings & Document;

/** One per clinic. Secrets are stored sealed (see secret-box.util) and never returned. */
@Schema({ timestamps: true, collection: 'reminder_settings' })
export class ReminderSettings {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true, unique: true })
    clinicId: Types.ObjectId;

    @Prop({ default: false })
    enabled: boolean;

    @Prop({ default: true })
    dayBeforeEnabled: boolean;

    /** Clinic-time `HH:mm` the day-before reminders go out. */
    @Prop({ default: '10:00' })
    dayBeforeTime: string;

    @Prop({ default: false })
    hoursBeforeEnabled: boolean;

    @Prop({ default: 2, min: 1, max: 12 })
    hoursBefore: number;

    @Prop()
    telegramBotTokenSealed: string;

    @Prop({ trim: true })
    telegramBotUsername: string;

    /** Telegram sends it back with each webhook call, so a forged call is refused. */
    @Prop()
    telegramWebhookSecret: string;

    @Prop()
    telegramWebhookSetAt: Date;

    @Prop({ enum: SmsProvider, default: SmsProvider.OFF })
    smsProvider: SmsProvider;

    @Prop({ trim: true })
    twilioAccountSid: string;

    @Prop()
    twilioAuthTokenSealed: string;

    /** Sender: a Twilio number in E.164 or an alphanumeric sender ID. */
    @Prop({ trim: true })
    twilioFrom: string;
}

export const ReminderSettingsSchema = SchemaFactory.createForClass(ReminderSettings);

export type ReminderLogDocument = ReminderLog & Document;

/**
 * Every reminder: what was sent, how, and what came of it. The unique index
 * on (appointment, rule) is what makes a reminder go out at most once, even
 * with two servers or two overlapping runs.
 */
@Schema({ timestamps: true, collection: 'reminder_log' })
export class ReminderLog {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Appointment', required: true })
    appointmentId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Patient', required: true })
    patientId: Types.ObjectId;

    @Prop({ required: true, enum: ReminderRule })
    rule: ReminderRule;

    @Prop({ required: true, enum: ReminderStatus, default: ReminderStatus.PENDING })
    status: ReminderStatus;

    @Prop({ enum: ReminderChannel })
    channel: ReminderChannel;

    /** Masked phone or "Telegram". */
    @Prop()
    to: string;

    @Prop()
    text: string;

    /** Why it failed or was skipped: a code the UI translates, or the provider's message. */
    @Prop()
    reason: string;

    @Prop()
    providerMessageId: string;

    @Prop()
    telegramChatId: string;

    @Prop()
    telegramMessageId: number;

    /** The patient's answer from the Telegram buttons. */
    @Prop({ enum: ['confirmed', 'cancelled'] })
    answer: string;

    @Prop()
    answeredAt: Date;
}

export const ReminderLogSchema = SchemaFactory.createForClass(ReminderLog);

ReminderLogSchema.index({ appointmentId: 1, rule: 1 }, { unique: true });
ReminderLogSchema.index({ clinicId: 1, createdAt: -1 });
