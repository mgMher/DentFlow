import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { ClinicRefsService } from 'src/common/clinic-refs';
import {
    addDays,
    clinicDayRange,
    clinicTimeToUtc,
    errorBody,
    openSecret,
    sealSecret,
    toClinicDateString,
    toClinicTimeString,
} from 'src/common/utils';
import { Appointment, AppointmentDocument, AppointmentStatus, CancelReason } from '../appointments/appointment.schema';
import { AppointmentsService } from '../appointments/appointments.service';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import {
    NotificationTemplate,
    NotificationTemplateDocument,
    TemplateChannel,
    TemplateType,
} from '../settings/notification-template.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationRelatedType, NotificationType } from '../notifications/notification.schema';
import {
    ReminderChannel,
    ReminderLog,
    ReminderLogDocument,
    ReminderRule,
    ReminderSettings,
    ReminderSettingsDocument,
    ReminderStatus,
    SmsProvider,
} from './reminder.schemas';
import { ChannelError, maskPhone, SmsSender, TelegramBot, TelegramButton, TwilioSms } from './channels';
import { displayDate, fill, Lang, langOf, message, REMINDER_PLACEHOLDERS } from './messages';
import { PatientRemindersDto, TestReminderDto, UpdateReminderSettingsDto } from './dto/reminders.dto';
import { AuditService } from '../audit/audit.service';
import { FamilyService } from '../patients/family.service';

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id.toString());
const BOT_TOKEN = 'telegram-bot-token';
const TWILIO_TOKEN = 'twilio-auth-token';
/** Reminders go out only in the daytime, clinic time. */
const DAY_START = '08:00';
const DAY_END = '21:00';
const LINK_VALID_MS = 30 * 24 * 3_600_000;
const OPEN = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
const PERSON = 'firstName lastName';

type PatientRef = Pick<Patient, 'firstName' | 'lastName' | 'phone' | 'telegramChatId' | 'remindersOptOut'> &
    Partial<Pick<Patient, 'dateOfBirth' | 'guardians'>> & {
    _id: Types.ObjectId;
};
/** What deciding who gets a patient's messages needs (F8: age and guardians too). */
const RECIPIENT_FIELDS = 'firstName lastName phone telegramChatId dateOfBirth guardians';
type ClinicInfo = Pick<Clinic, 'name' | 'phone' | 'address' | 'language' | 'timezone'> & { _id: Types.ObjectId };
type Delivery = Partial<Pick<ReminderLog, 'channel' | 'to' | 'reason' | 'providerMessageId' | 'telegramChatId' | 'telegramMessageId' | 'guardian'>> & {
    status: ReminderStatus;
};

/**
 * Appointment reminders (F3). Every minute the due reminders are found and
 * sent: by Telegram when the patient has linked it, otherwise by SMS, else
 * logged as skipped. A reminder is written to the log *before* it is sent,
 * under a unique (appointment, rule) key, so it goes out at most once.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RemindersService.name);
    private running = false;
    private poller?: NodeJS.Timeout;
    private readonly pollOffsets = new Map<string, number>();

    constructor(
        @InjectModel(ReminderSettings.name) private readonly settingsModel: Model<ReminderSettingsDocument>,
        @InjectModel(ReminderLog.name) private readonly logModel: Model<ReminderLogDocument>,
        @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
        @InjectModel(NotificationTemplate.name) private readonly templateModel: Model<NotificationTemplateDocument>,
        private readonly appointments: AppointmentsService,
        private readonly notifications: NotificationsService,
        private readonly clinicRefs: ClinicRefsService,
        private readonly audit: AuditService,
        private readonly family: FamilyService,
    ) {}

    // ── Settings ─────────────────────────────────────────────────────────────

    async getSettings(clinicId: string) {
        const clinic = await this.clinicInfo(clinicId);
        const language = langOf(clinic.language);
        return {
            ...this.present(await this.settingsFor(clinicId)),
            // The clinic writes its own text as an "appointment reminder" SMS template in this language.
            language,
            defaultText: message('reminder', language, Object.fromEntries(REMINDER_PLACEHOLDERS.map((p) => [p, `{{${p}}}`]))),
            placeholders: REMINDER_PLACEHOLDERS,
        };
    }

    async updateSettings(clinicId: string, dto: UpdateReminderSettingsDto) {
        const current = await this.settingsFor(clinicId);
        const $set: Record<string, unknown> = {};
        const $unset: Record<string, ''> = {};
        for (const key of ['enabled', 'dayBeforeEnabled', 'dayBeforeTime', 'hoursBeforeEnabled', 'hoursBefore', 'smsProvider', 'twilioAccountSid', 'twilioFrom'] as const) {
            if (dto[key] !== undefined) $set[key] = dto[key];
        }
        if (dto.dayBeforeTime && (dto.dayBeforeTime < DAY_START || dto.dayBeforeTime >= '20:00')) {
            throw new BadRequestException(errorBody('reminderTimeAtNight', 'Choose a time between 08:00 and 20:00'));
        }
        if (dto.twilioAuthToken === null) $unset.twilioAuthTokenSealed = '';
        else if (dto.twilioAuthToken) $set.twilioAuthTokenSealed = sealSecret(dto.twilioAuthToken, TWILIO_TOKEN);

        if (dto.telegramBotToken === null) {
            await this.botFor(current)?.call('deleteWebhook').catch(() => undefined);
            Object.assign($unset, { telegramBotTokenSealed: '', telegramBotUsername: '', telegramWebhookSecret: '', telegramWebhookSetAt: '' });
            await this.forgetTelegramChats(clinicId);
        } else if (dto.telegramBotToken) {
            const bot = new TelegramBot(dto.telegramBotToken);
            const me = await bot.getMe().catch(() => {
                throw new BadRequestException(errorBody('telegramTokenInvalid', 'Telegram did not accept this bot token'));
            });
            // Chats belong to a bot: with another bot, patients must link again.
            if (current.telegramBotUsername && current.telegramBotUsername !== me.username) await this.forgetTelegramChats(clinicId);
            Object.assign($set, {
                telegramBotTokenSealed: sealSecret(dto.telegramBotToken, BOT_TOKEN),
                telegramBotUsername: me.username,
                telegramWebhookSecret: randomBytes(24).toString('base64url'),
            });
            $unset.telegramWebhookSetAt = '';
        }

        const saved = await this.settingsModel.findOneAndUpdate(
            { clinicId: oid(clinicId) },
            { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) },
            { new: true, upsert: true },
        );
        if (dto.telegramBotToken && saved) await this.registerWebhook(saved);
        // Same shape as a read, so the page can use either answer.
        return this.getSettings(clinicId);
    }

    /** Settings as the UI sees them: secrets only as "set / not set". */
    private present(s: ReminderSettings) {
        return {
            enabled: !!s.enabled,
            dayBeforeEnabled: s.dayBeforeEnabled ?? true,
            dayBeforeTime: s.dayBeforeTime ?? '10:00',
            hoursBeforeEnabled: !!s.hoursBeforeEnabled,
            hoursBefore: s.hoursBefore ?? 2,
            telegram: {
                connected: !!s.telegramBotTokenSealed,
                botUsername: s.telegramBotUsername ?? null,
                mode: !s.telegramBotTokenSealed ? 'none' : s.telegramWebhookSetAt ? 'webhook' : process.env.TELEGRAM_POLLING === '1' ? 'polling' : 'not_receiving',
            },
            sms: {
                provider: s.smsProvider ?? SmsProvider.OFF,
                twilioAccountSid: s.twilioAccountSid ?? '',
                twilioFrom: s.twilioFrom ?? '',
                hasAuthToken: !!s.twilioAuthTokenSealed,
            },
        };
    }

    /**
     * Telegram calls us back at `PUBLIC_API_URL`. Without one (local
     * development) updates are fetched by polling when TELEGRAM_POLLING=1.
     */
    private async registerWebhook(s: ReminderSettingsDocument) {
        const base = process.env.PUBLIC_API_URL?.replace(/\/+$/, '');
        const bot = this.botFor(s);
        if (!base || !bot) return;
        try {
            await bot.call('setWebhook', {
                url: `${base}/api/telegram/webhook/${s.clinicId}`,
                secret_token: s.telegramWebhookSecret,
                allowed_updates: ['message', 'callback_query'],
            });
            s.telegramWebhookSetAt = new Date();
            await s.save();
        } catch (err) {
            this.logger.warn(`setWebhook failed for clinic ${s.clinicId}: ${(err as Error).message}`);
        }
    }

    private async settingsFor(clinicId: string | Types.ObjectId): Promise<ReminderSettingsDocument> {
        return (
            (await this.settingsModel.findOne({ clinicId: oid(clinicId) })) ??
            new this.settingsModel({ clinicId: oid(clinicId) })
        );
    }

    private botFor(s: Pick<ReminderSettings, 'telegramBotTokenSealed'> | null): TelegramBot | null {
        const token = openSecret(s?.telegramBotTokenSealed, BOT_TOKEN);
        return token ? new TelegramBot(token) : null;
    }

    private smsFor(s: ReminderSettings): { sender: SmsSender; channel: ReminderChannel } | null {
        if (s.smsProvider === SmsProvider.LOG) {
            return { sender: { send: async () => ({ id: 'log' }) }, channel: ReminderChannel.LOG };
        }
        if (s.smsProvider === SmsProvider.TWILIO) {
            const token = openSecret(s.twilioAuthTokenSealed, TWILIO_TOKEN);
            if (!token || !s.twilioAccountSid || !s.twilioFrom) return null;
            return { sender: new TwilioSms(s.twilioAccountSid, token, s.twilioFrom), channel: ReminderChannel.SMS };
        }
        return null;
    }

    private async forgetTelegramChats(clinicId: string | Types.ObjectId) {
        await this.patientModel.updateMany(
            { clinicId: oid(clinicId), telegramChatId: { $exists: true } },
            { $unset: { telegramChatId: '', telegramLinkedAt: '' } },
        );
    }

    // ── The run ──────────────────────────────────────────────────────────────

    @Cron(CronExpression.EVERY_MINUTE)
    async onTick() {
        if (process.env.REMINDERS_CRON === 'off') return;
        await this.tick();
    }

    /** Find and send every reminder due at `now`. Safe to call concurrently. */
    async tick(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
        const totals = { sent: 0, skipped: 0, failed: 0 };
        if (this.running) return totals;
        this.running = true;
        try {
            const all = await this.settingsModel.find({ enabled: true });
            for (const settings of all) {
                try {
                    const result = await this.tickClinic(settings, now);
                    totals.sent += result.sent;
                    totals.skipped += result.skipped;
                    totals.failed += result.failed;
                } catch (err) {
                    this.logger.error(`Reminders for clinic ${settings.clinicId} failed: ${(err as Error).message}`);
                }
            }
        } finally {
            this.running = false;
        }
        return totals;
    }

    private async tickClinic(settings: ReminderSettingsDocument, now: Date) {
        const clinic = await this.clinicInfo(settings.clinicId);
        const tz = clinic.timezone;
        const today = toClinicDateString(now, tz);
        const time = toClinicTimeString(now, tz);
        const totals = { sent: 0, skipped: 0, failed: 0 };
        if (time < DAY_START || time >= DAY_END) return totals;

        const due: { appointment: AppointmentDocument; rule: ReminderRule }[] = [];

        // Tomorrow's visits, from the set time on (later runs catch up if the server was down).
        if (settings.dayBeforeEnabled && time >= settings.dayBeforeTime) {
            const sendAt = clinicTimeToUtc(today, settings.dayBeforeTime, tz);
            const { start, end } = clinicDayRange(addDays(today, 1), tz);
            const list = await this.appointmentModel.find({
                clinicId: settings.clinicId,
                status: { $in: OPEN },
                startTime: { $gte: start, $lt: end },
                // Booked after the reminder time: the patient knows already.
                createdAt: { $lt: sendAt },
            });
            due.push(...list.map((appointment) => ({ appointment, rule: ReminderRule.DAY_BEFORE })));
        }

        // Visits starting within the next N hours that were booked before that window opened.
        if (settings.hoursBeforeEnabled) {
            const windowMs = settings.hoursBefore * 3_600_000;
            const list = await this.appointmentModel.find({
                clinicId: settings.clinicId,
                status: { $in: OPEN },
                startTime: { $gt: now, $lte: new Date(now.getTime() + windowMs) },
            });
            due.push(
                ...list
                    .filter((a) => (a as any).createdAt < new Date(a.startTime.getTime() - windowMs))
                    .map((appointment) => ({ appointment, rule: ReminderRule.HOURS_BEFORE })),
            );
        }
        if (!due.length) return totals;

        const done = await this.logModel
            .find({ $or: due.map((d) => ({ appointmentId: d.appointment._id, rule: d.rule })) })
            .select('appointmentId rule')
            .lean();
        const seen = new Set(done.map((d) => `${d.appointmentId}:${d.rule}`));

        for (const { appointment, rule } of due) {
            if (seen.has(`${appointment._id}:${rule}`)) continue;
            const status = await this.remind(settings, clinic, appointment, rule);
            if (status === ReminderStatus.SENT) totals.sent++;
            else if (status === ReminderStatus.FAILED) totals.failed++;
            else if (status === ReminderStatus.SKIPPED) totals.skipped++;
        }
        return totals;
    }

    private async remind(
        settings: ReminderSettings,
        clinic: ClinicInfo,
        appointment: AppointmentDocument,
        rule: ReminderRule,
    ): Promise<ReminderStatus | null> {
        let log: ReminderLogDocument;
        try {
            log = await this.logModel.create({
                clinicId: appointment.clinicId,
                appointmentId: appointment._id,
                patientId: appointment.patientId,
                rule,
                status: ReminderStatus.PENDING,
            });
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return null; // another run has it
            throw err;
        }

        await appointment.populate([
            { path: 'patientId', select: `${RECIPIENT_FIELDS} remindersOptOut` },
            { path: 'dentistId', select: PERSON },
        ]);
        const patient = appointment.patientId as unknown as PatientRef | null;
        let delivery: Delivery;
        let text = '';
        if (!patient) {
            delivery = { status: ReminderStatus.SKIPPED, reason: 'patientMissing' };
        } else if (patient.remindersOptOut) {
            delivery = { status: ReminderStatus.SKIPPED, reason: 'optedOut' };
        } else {
            text = await this.reminderText(clinic, appointment, patient);
            const { target, guardian } = await this.recipient(clinic, patient);
            delivery = await this.deliver(settings, target, text, [
                [
                    { text: message('confirm', langOf(clinic.language)), callback_data: `c:${appointment._id}` },
                    { text: message('cancel', langOf(clinic.language)), callback_data: `x:${appointment._id}` },
                ],
            ]);
            if (guardian) delivery = { ...delivery, guardian };
        }
        await this.logModel.updateOne({ _id: log._id }, { $set: { ...delivery, text } });
        return delivery.status;
    }

    /**
     * Under 18 with a guardian, messages go to the main guardian (F8): their
     * Telegram or phone if they are a patient, the contact's phone otherwise.
     * The text still names the child.
     */
    private async recipient(clinic: ClinicInfo, patient: PatientRef): Promise<{ target: PatientRef; guardian?: Delivery['guardian'] }> {
        const to = await this.family.recipientFor(clinic._id, patient, clinic.timezone);
        if (!to) return { target: patient };
        return {
            target: { ...patient, _id: to.patientId ?? patient._id, phone: to.phone ?? '', telegramChatId: to.patientId ? to.telegramChatId ?? '' : '' },
            guardian: to.guardian,
        };
    }

    /** Telegram first; SMS when there is no linked chat or Telegram refused. */
    private async deliver(
        settings: ReminderSettings,
        patient: PatientRef,
        text: string,
        buttons?: TelegramButton[][],
        only?: 'telegram' | 'sms',
    ): Promise<Delivery> {
        let telegramFailure: string | undefined;
        const bot = only === 'sms' ? null : this.botFor(settings);
        if (bot && patient.telegramChatId) {
            try {
                const sent = await bot.sendMessage(patient.telegramChatId, text, buttons);
                return {
                    status: ReminderStatus.SENT,
                    channel: ReminderChannel.TELEGRAM,
                    to: 'Telegram',
                    telegramChatId: patient.telegramChatId,
                    telegramMessageId: sent.message_id,
                };
            } catch (err) {
                telegramFailure = (err as Error).message;
                // Blocked the bot or deleted the chat: stop trying Telegram for this patient.
                if (err instanceof ChannelError && (err.status === 403 || /chat not found/i.test(err.message))) {
                    await this.patientModel.updateOne({ _id: patient._id }, { $unset: { telegramChatId: '', telegramLinkedAt: '' } });
                }
            }
        }
        const sms = only === 'telegram' ? null : this.smsFor(settings);
        if (sms && patient.phone) {
            try {
                const sent = await sms.sender.send(patient.phone, text);
                return { status: ReminderStatus.SENT, channel: sms.channel, to: maskPhone(patient.phone), providerMessageId: sent.id };
            } catch (err) {
                return { status: ReminderStatus.FAILED, channel: sms.channel, to: maskPhone(patient.phone), reason: (err as Error).message };
            }
        }
        if (telegramFailure) return { status: ReminderStatus.FAILED, channel: ReminderChannel.TELEGRAM, to: 'Telegram', reason: telegramFailure };
        return { status: ReminderStatus.SKIPPED, reason: 'noChannel' };
    }

    private async reminderText(clinic: ClinicInfo, appointment: AppointmentDocument, patient: PatientRef) {
        const lang = langOf(clinic.language);
        const template = await this.templateModel
            .findOne({
                clinicId: clinic._id,
                type: TemplateType.APPOINTMENT_REMINDER,
                channel: TemplateChannel.SMS,
                language: lang,
                isActive: true,
            })
            .select('bodyTemplate')
            .lean();
        const dentist = appointment.dentistId as unknown as { firstName?: string; lastName?: string } | null;
        const vars = {
            ...this.clinicVars(clinic),
            patient: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
            date: displayDate(toClinicDateString(appointment.startTime, clinic.timezone)),
            time: toClinicTimeString(appointment.startTime, clinic.timezone),
            dentist: [dentist?.firstName, dentist?.lastName].filter(Boolean).join(' '),
        };
        // Older templates use {{patientName}} / {{dentistName}} (the template API's original wording).
        const aliases = { patientName: vars.patient, dentistName: vars.dentist };
        return template?.bodyTemplate ? fill(template.bodyTemplate, { ...vars, ...aliases }) : message('reminder', lang, vars);
    }

    private clinicVars(clinic: ClinicInfo) {
        return {
            clinic: clinic.name,
            phone: clinic.phone ?? '',
            address: [clinic.address?.street, clinic.address?.city].filter(Boolean).join(', '),
        };
    }

    private async clinicInfo(clinicId: Types.ObjectId | string): Promise<ClinicInfo> {
        const clinic = await this.clinicModel.findById(oid(clinicId)).select('name phone address language timezone').lean();
        return {
            _id: oid(clinicId),
            name: clinic?.name ?? '',
            phone: clinic?.phone ?? '',
            address: clinic?.address as Clinic['address'],
            language: clinic?.language as Clinic['language'],
            timezone: clinic?.timezone || 'Asia/Yerevan',
        };
    }

    // ── Telegram updates (webhook or polling) ────────────────────────────────

    /** True when the call carries the secret this clinic's webhook was registered with. */
    async webhookSecretMatches(clinicId: string, secret: string | undefined) {
        if (!Types.ObjectId.isValid(clinicId) || !secret) return false;
        const s = await this.settingsModel.findOne({ clinicId: oid(clinicId) }).select('telegramWebhookSecret').lean();
        return !!s?.telegramWebhookSecret && s.telegramWebhookSecret === secret;
    }

    async handleUpdate(clinicId: string, update: any): Promise<void> {
        const settings = await this.settingsModel.findOne({ clinicId: oid(clinicId) });
        const bot = this.botFor(settings);
        if (!settings || !bot) return;
        const clinic = await this.clinicInfo(clinicId);
        const lang = langOf(clinic.language);

        try {
            if (update?.message?.text) await this.handleMessage(clinic, lang, bot, update.message);
            else if (update?.callback_query) await this.handleButton(clinic, lang, bot, update.callback_query);
        } catch (err) {
            this.logger.warn(`Telegram update for clinic ${clinicId} failed: ${(err as Error).message}`);
        }
    }

    private async handleMessage(clinic: ClinicInfo, lang: Lang, bot: TelegramBot, msg: any) {
        const chatId = String(msg.chat?.id ?? '');
        const [command, code] = String(msg.text).trim().split(/\s+/);
        if (!chatId) return;

        if (command === '/start') {
            const patient = code
                ? await this.patientModel.findOneAndUpdate(
                      { clinicId: clinic._id, telegramLinkCode: code, telegramLinkCodeAt: { $gt: new Date(Date.now() - LINK_VALID_MS) } },
                      { $set: { telegramChatId: chatId, telegramLinkedAt: new Date() }, $unset: { telegramLinkCode: '', telegramLinkCodeAt: '' } },
                      { new: true },
                  )
                : null;
            await bot.sendMessage(
                chatId,
                patient
                    ? message('linked', lang, { ...this.clinicVars(clinic), patient: patient.firstName })
                    : message('badLink', lang),
            );
        } else if (command === '/stop') {
            await this.patientModel.updateMany(
                { clinicId: clinic._id, telegramChatId: chatId },
                { $unset: { telegramChatId: '', telegramLinkedAt: '' } },
            );
            await bot.sendMessage(chatId, message('stopped', lang));
        }
    }

    /** "I will come" confirms; "I can't come" cancels and tells the dentist and the front desk. */
    private async handleButton(clinic: ClinicInfo, lang: Lang, bot: TelegramBot, query: any) {
        const chatId = String(query.message?.chat?.id ?? query.from?.id ?? '');
        const [action, appointmentId] = String(query.data ?? '').split(':');
        const vars = this.clinicVars(clinic);
        const answer = (text: string) => bot.call('answerCallbackQuery', { callback_query_id: query.id, text }).catch(() => undefined);

        const appointment =
            Types.ObjectId.isValid(appointmentId) && ['c', 'x'].includes(action)
                ? await this.appointmentModel
                      .findOne({ _id: oid(appointmentId), clinicId: clinic._id })
                      .populate({ path: 'patientId', select: RECIPIENT_FIELDS })
                : null;
        const patient = appointment?.patientId as unknown as PatientRef | undefined;
        const open = appointment && OPEN.includes(appointment.status) && appointment.startTime > new Date();
        // The patient's own chat, or the chat their reminders go to (a minor's main guardian).
        const routed = patient ? await this.recipient(clinic, patient) : null;
        const allowed = patient ? [patient.telegramChatId, routed!.target.telegramChatId] : [];
        if (!appointment || !patient || !chatId || !allowed.includes(chatId) || !open) {
            await answer(message('tooLate', lang, vars));
            return;
        }

        let reply: string;
        const auditAnswer = (event: string, to: AppointmentStatus) =>
            this.audit.record({
                clinicId: clinic._id,
                // The child's own chat, or their guardian answering for them.
                actor: {
                    kind: 'patient',
                    name:
                        chatId !== patient.telegramChatId && routed?.guardian
                            ? routed.guardian.name
                            : [patient.firstName, patient.lastName].filter(Boolean).join(' '),
                },
                event,
                targetId: appointment._id,
                patientId: patient._id,
                changes: [{ field: 'status', from: appointment.status, to }],
                details: {
                    channel: 'telegram',
                    startTime: appointment.startTime.toISOString(),
                    ...(chatId !== patient.telegramChatId && routed?.guardian ? { guardian: routed.guardian.relationship } : {}),
                },
            });
        if (action === 'c') {
            if (appointment.status === AppointmentStatus.SCHEDULED) {
                await this.appointments.updateStatus(clinic._id.toString(), appointment._id, AppointmentStatus.CONFIRMED);
                await auditAnswer('appointments.patientConfirmed', AppointmentStatus.CONFIRMED);
            }
            reply = message('confirmed', lang, vars);
        } else {
            await this.appointments.cancel(clinic._id.toString(), appointment._id, {
                reason: CancelReason.PATIENT_REQUEST,
                note: 'Telegram',
            });
            await auditAnswer('appointments.patientCancelled', AppointmentStatus.CANCELLED);
            await this.notifications.notify({
                clinicId: clinic._id,
                recipients: await this.notifications.staffWithRoles(clinic._id, [Role.CLINIC_ADMIN, Role.RECEPTIONIST]),
                type: NotificationType.APPOINTMENT_CANCELLED,
                relatedId: appointment._id,
                relatedType: NotificationRelatedType.APPOINTMENT,
                data: {
                    patientName: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
                    startTime: appointment.startTime,
                    count: 1,
                    reason: CancelReason.PATIENT_REQUEST,
                },
            });
            reply = message('cancelled', lang, vars);
        }

        await this.logModel.updateMany(
            { appointmentId: appointment._id, channel: ReminderChannel.TELEGRAM },
            { $set: { answer: action === 'c' ? 'confirmed' : 'cancelled', answeredAt: new Date() } },
        );
        await answer(reply);
        // Replace the buttons with the outcome, so the message can't be answered twice.
        if (query.message?.message_id) {
            await bot
                .call('editMessageText', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    text: `${query.message.text ?? ''}\n\n${reply}`,
                })
                .catch(() => undefined);
        }
    }

    /** Local development: fetch updates instead of a webhook (TELEGRAM_POLLING=1). */
    onModuleInit() {
        if (process.env.TELEGRAM_POLLING !== '1') return;
        this.poller = setInterval(() => void this.poll(), 3000);
    }

    onModuleDestroy() {
        if (this.poller) clearInterval(this.poller);
    }

    private polling = false;
    private async poll() {
        if (this.polling) return;
        this.polling = true;
        try {
            const all = await this.settingsModel.find({ telegramBotTokenSealed: { $exists: true }, telegramWebhookSetAt: { $exists: false } });
            for (const s of all) {
                const key = s.clinicId.toString();
                const updates = await this.botFor(s)!
                    .call<any[]>('getUpdates', { offset: this.pollOffsets.get(key) ?? 0, timeout: 0 })
                    .catch(() => []);
                for (const update of updates) {
                    this.pollOffsets.set(key, update.update_id + 1);
                    await this.handleUpdate(key, update);
                }
            }
        } finally {
            this.polling = false;
        }
    }

    // ── Patients ─────────────────────────────────────────────────────────────

    async patientStatus(clinicId: string, patientId: string) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const [patient, settings] = await Promise.all([
            this.patientModel.findById(oid(patientId)).select('remindersOptOut telegramChatId telegramLinkedAt phone dateOfBirth guardians').lean(),
            this.settingsFor(clinicId),
        ]);
        // F8: a minor's reminders go to their main guardian, by Telegram if they linked it, else SMS.
        const routed = patient ? await this.recipient(await this.clinicInfo(clinicId), patient as unknown as PatientRef) : null;
        const guardian = routed?.guardian
            ? {
                  ...routed.guardian,
                  channel: settings.telegramBotTokenSealed && routed.target.telegramChatId ? 'telegram' : this.smsFor(settings) && routed.target.phone ? 'sms' : null,
              }
            : null;
        return {
            guardian,
            enabled: !!settings.enabled,
            optOut: !!patient?.remindersOptOut,
            telegramAvailable: !!settings.telegramBotTokenSealed,
            telegramLinked: !!patient?.telegramChatId,
            telegramLinkedAt: patient?.telegramLinkedAt ?? null,
            smsAvailable: !!this.smsFor(settings) && !!patient?.phone,
        };
    }

    async setOptOut(clinicId: string, patientId: string, dto: PatientRemindersDto) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        await this.patientModel.updateOne({ _id: oid(patientId), clinicId: oid(clinicId) }, { $set: { remindersOptOut: dto.optOut } });
        return this.patientStatus(clinicId, patientId);
    }

    /** A one-time link that ties the patient's Telegram chat to their record. Valid 30 days. */
    async telegramLink(clinicId: string, patientId: string) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        const settings = await this.settingsFor(clinicId);
        if (!settings.telegramBotTokenSealed || !settings.telegramBotUsername) {
            throw new BadRequestException(errorBody('telegramNotConnected', 'Connect a Telegram bot in Settings → Reminders first'));
        }
        const code = randomBytes(12).toString('base64url');
        await this.patientModel.updateOne(
            { _id: oid(patientId), clinicId: oid(clinicId) },
            { $set: { telegramLinkCode: code, telegramLinkCodeAt: new Date() } },
        );
        return { link: `https://t.me/${settings.telegramBotUsername}?start=${code}` };
    }

    async sendTelegramLinkBySms(clinicId: string, patientId: string) {
        const { link } = await this.telegramLink(clinicId, patientId);
        const settings = await this.settingsFor(clinicId);
        const patient = await this.patientModel.findById(oid(patientId)).select('phone').lean();
        const sms = this.smsFor(settings);
        if (!sms || !patient?.phone) throw new BadRequestException(errorBody('smsNotConfigured', 'SMS is not set up'));
        const clinic = await this.clinicInfo(clinicId);
        try {
            await sms.sender.send(patient.phone, message('linkSms', langOf(clinic.language), { ...this.clinicVars(clinic), link }));
        } catch (err) {
            throw new BadRequestException(errorBody('reminderSendFailed', (err as Error).message));
        }
        return { sent: true, to: maskPhone(patient.phone), channel: sms.channel };
    }

    async unlinkTelegram(clinicId: string, patientId: string) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        await this.patientModel.updateOne(
            { _id: oid(patientId), clinicId: oid(clinicId) },
            { $unset: { telegramChatId: '', telegramLinkedAt: '', telegramLinkCode: '', telegramLinkCodeAt: '' } },
        );
        return this.patientStatus(clinicId, patientId);
    }

    /** Admin: send a test message to one patient through one channel. */
    async test(clinicId: string, dto: TestReminderDto) {
        await this.clinicRefs.assertPatient(clinicId, dto.patientId);
        const settings = await this.settingsFor(clinicId);
        const clinic = await this.clinicInfo(clinicId);
        const patient = (await this.patientModel
            .findById(oid(dto.patientId))
            .select(`${RECIPIENT_FIELDS} remindersOptOut`)
            .lean()) as PatientRef | null;
        // A test goes where real reminders would: a minor's main guardian.
        const { target, guardian } = await this.recipient(clinic, patient!);
        const result = await this.deliver(settings, target, message('test', langOf(clinic.language), this.clinicVars(clinic)), undefined, dto.channel);
        if (result.status !== ReminderStatus.SENT) {
            throw new BadRequestException(errorBody(result.reason === 'noChannel' ? 'reminderNoChannel' : 'reminderSendFailed', result.reason ?? ''));
        }
        return { sent: true, channel: result.channel, to: result.to, guardian };
    }

    // ── Log ──────────────────────────────────────────────────────────────────

    async logForAppointment(clinicId: string, appointmentId: string) {
        return this.logModel
            .find({ clinicId: oid(clinicId), appointmentId: oid(appointmentId) })
            .sort({ createdAt: -1 })
            .select('-telegramChatId')
            .lean();
    }

    async recentLog(clinicId: string) {
        return this.logModel
            .find({ clinicId: oid(clinicId) })
            .sort({ createdAt: -1 })
            .limit(100)
            .select('-telegramChatId')
            .populate({ path: 'patientId', select: PERSON })
            .populate({ path: 'appointmentId', select: 'startTime status' })
            .lean();
    }
}
