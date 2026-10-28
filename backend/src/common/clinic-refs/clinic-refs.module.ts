import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/modules/auth/auth.schema';
import { Patient, PatientSchema } from 'src/modules/patients/patient.schema';
import { TreatmentRoom, TreatmentRoomSchema } from 'src/modules/schedule/treatment-room.schema';
import { Treatment, TreatmentSchema } from 'src/modules/treatments/treatment.schema';
import { Appointment, AppointmentSchema } from 'src/modules/appointments/appointment.schema';
import { ClinicRefsService } from './clinic-refs.service';

/** Global so any feature module can verify body references without importing five others. */
@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Patient.name, schema: PatientSchema },
            { name: TreatmentRoom.name, schema: TreatmentRoomSchema },
            { name: Treatment.name, schema: TreatmentSchema },
            { name: Appointment.name, schema: AppointmentSchema },
        ]),
    ],
    providers: [ClinicRefsService],
    exports: [ClinicRefsService],
})
export class ClinicRefsModule {}
