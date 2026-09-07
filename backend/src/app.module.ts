import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {MongooseModule} from '@nestjs/mongoose';
import {APP_GUARD} from '@nestjs/core';
import {AuthGuard, ClinicGuard, RolesGuard} from 'src/common';
import {AuthModule} from './modules/auth/auth.module';
import {ClinicsModule} from './modules/clinics/clinics.module';
import {UsersModule} from './modules/users/users.module';
import {PatientsModule} from './modules/patients/patients.module';
import {AppointmentsModule} from './modules/appointments/appointments.module';
import {TreatmentsModule} from './modules/treatments/treatments.module';
import {DentalRecordsModule} from './modules/dental-records/dental-records.module';
import {BillingModule} from './modules/billing/billing.module';
import {ScheduleModule} from './modules/schedule/schedule.module';
import {NotificationsModule} from './modules/notifications/notifications.module';
import {ReportsModule} from './modules/reports/reports.module';
import {SettingsModule} from './modules/settings/settings.module';

@Module({
    imports: [
        ConfigModule.forRoot({isGlobal: true}),
        MongooseModule.forRoot('mongodb+srv://eachbase:oh9nDM0ButKeSZ8n@dev.wrsq2ox.mongodb.net/TL_D?retryWrites=true&w=majority'),
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
        {provide: APP_GUARD, useClass: AuthGuard},
        {provide: APP_GUARD, useClass: RolesGuard},
        {provide: APP_GUARD, useClass: ClinicGuard},
    ],
})
export class AppModule {
}
