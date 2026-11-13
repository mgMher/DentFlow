import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule as CronModule } from '@nestjs/schedule';
import { Appointment, AppointmentSchema } from '../appointments/appointment.schema';
import { AppointmentsModule } from '../appointments/appointments.module';
import { Patient, PatientSchema } from '../patients/patient.schema';
import { Clinic, ClinicSchema } from '../clinics/clinic.schema';
import { NotificationTemplate, NotificationTemplateSchema } from '../settings/notification-template.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { ReminderLog, ReminderLogSchema, ReminderSettings, ReminderSettingsSchema } from './reminder.schemas';
import { RemindersService } from './reminders.service';
import { RemindersController, TelegramWebhookController } from './reminders.controller';

/** F3: appointment reminders by Telegram and SMS, with the patient's answer from Telegram. */
@Module({
    imports: [
        // `@nestjs/schedule` (cron); not our ScheduleModule, which is the dentists' schedule.
        CronModule.forRoot(),
        MongooseModule.forFeature([
            { name: ReminderSettings.name, schema: ReminderSettingsSchema },
            { name: ReminderLog.name, schema: ReminderLogSchema },
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Patient.name, schema: PatientSchema },
            { name: Clinic.name, schema: ClinicSchema },
            { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
        ]),
        AppointmentsModule,
        NotificationsModule,
        PatientsModule,
    ],
    controllers: [RemindersController, TelegramWebhookController],
    providers: [RemindersService],
})
export class RemindersModule {}
