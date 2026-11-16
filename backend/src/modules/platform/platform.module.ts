import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../audit/audit-log.schema';
import { AuthModule } from '../auth/auth.module';
import { Clinic, ClinicSchema } from '../clinics/clinic.schema';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
    imports: [
        AuthModule,
        MongooseModule.forFeature([
            { name: Clinic.name, schema: ClinicSchema },
            { name: AuditLog.name, schema: AuditLogSchema },
        ]),
    ],
    controllers: [PlatformController],
    providers: [PlatformService],
})
export class PlatformModule {}
