import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from './appointment.schema';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PatientsModule } from '../patients/patients.module';
import { UserProfile, UserProfileSchema } from '../users/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Appointment.name, schema: AppointmentSchema },
            // Needed only to repoint legacy dentistId values onto auth User ids.
            { name: UserProfile.name, schema: UserProfileSchema },
        ]),
        PatientsModule,
    ],
    controllers: [AppointmentsController],
    providers: [AppointmentsService],
    exports: [AppointmentsService],
})
export class AppointmentsModule {}
