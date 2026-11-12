import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from './audit-log.schema';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

/** F7: who changed what. Global so any service can record events it handles itself (sign-ins, Telegram answers). */
@Global()
@Module({
    imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
    controllers: [AuditController],
    providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
    exports: [AuditService],
})
export class AuditModule {}
