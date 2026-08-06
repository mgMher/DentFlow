import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TreatmentRoom, TreatmentRoomSchema } from './treatment-room.schema';
import { BlockedTime, BlockedTimeSchema } from './blocked-time.schema';
import { Appointment, AppointmentSchema } from '../appointments/appointment.schema';
import { UserProfile, UserProfileSchema } from '../users/user.schema';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: TreatmentRoom.name, schema: TreatmentRoomSchema },
            { name: BlockedTime.name, schema: BlockedTimeSchema },
            { name: Appointment.name, schema: AppointmentSchema },
            { name: UserProfile.name, schema: UserProfileSchema },
        ]),
    ],
    controllers: [ScheduleController],
    providers: [ScheduleService],
    exports: [ScheduleService],
})
export class ScheduleModule {}
