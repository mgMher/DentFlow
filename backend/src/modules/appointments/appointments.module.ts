import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from './appointment.schema';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PatientsModule } from '../patients/patients.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { UserProfile, UserProfileSchema } from '../users/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Appointment.name, schema: AppointmentSchema },
            // Needed only to repoint legacy dentistId values onto auth User ids.
            { name: UserProfile.name, schema: UserProfileSchema },
        ]),
        PatientsModule,
        ScheduleModule,
        NotificationsModule,
    ],
    controllers: [AppointmentsController],
    providers: [AppointmentsService],
    exports: [AppointmentsService],
})
export class AppointmentsModule {}
