import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { getDatabaseConfig } from './config';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ClinicGuard } from './common/guards/clinic.guard';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';
import { DentalRecordsModule } from './modules/dental-records/dental-records.module';
import { BillingModule } from './modules/billing/billing.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/dentflow'),
        AuthModule,
        ClinicsModule,
        UsersModule,
        PatientsModule,
        AppointmentsModule,
        TreatmentsModule,
        DentalRecordsModule,
        BillingModule,
        ScheduleModule,
        NotificationsModule,
        ReportsModule,
        SettingsModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: ClinicGuard },
    ],
})
export class AppModule {}
