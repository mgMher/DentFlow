import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { AuditService } from './audit.service';
import { AuditPageDto, QueryAuditDto } from './dto/audit.dto';

const ADMINS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN];

@ApiTags('Audit log')
@ApiBearerAuth()
@Controller()
export class AuditController {
    constructor(private readonly audit: AuditService) {}

    @Get('audit')
    @Roles(...ADMINS)
    @ApiOperation({ summary: "The clinic's audit log, newest first (admins)" })
    list(@CurrentUser('clinicId') clinicId: string, @Query() query: QueryAuditDto) {
        return this.audit.list(new Types.ObjectId(clinicId), query);
    }

    @Get('patients/:patientId/history')
    @Roles(...ADMINS, Role.DENTIST)
    @ApiOperation({ summary: "Everything recorded about one patient (admins and dentists)" })
    patientHistory(
        @CurrentUser('clinicId') clinicId: string,
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Query() query: AuditPageDto,
    ) {
        return this.audit.patientHistory(new Types.ObjectId(clinicId), patientId, query);
    }
}
