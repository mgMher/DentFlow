import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from './auth.schema';
import { Clinic, ClinicSchema } from '../clinics/clinic.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Clinic.name, schema: ClinicSchema },
        ]),
    ],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService, MongooseModule],
})
export class AuthModule {}
