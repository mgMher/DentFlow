import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { User, UserSchema } from './auth.schema';
import { Session, SessionSchema } from './session.schema';
import { Clinic, ClinicSchema } from '../clinics/clinic.schema';
import { UserProfile, UserProfileSchema } from '../users/user.schema';
import { TreatmentsModule } from '../treatments/treatments.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Session.name, schema: SessionSchema },
            { name: Clinic.name, schema: ClinicSchema },
            { name: UserProfile.name, schema: UserProfileSchema },
        ]),
        TreatmentsModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, SessionsService],
    // SessionsService: the auth guard checks sessions, and staff management revokes them.
    exports: [AuthService, SessionsService, MongooseModule],
})
export class AuthModule {}
