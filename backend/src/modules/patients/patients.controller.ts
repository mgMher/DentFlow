import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { PatientsService } from './patients.service';
import {
    CreatePatientDto,
    QueryPatientDto,
    UpdatePatientDto,
    UpdatePatientStatusDto,
} from './dto';
import { PatientStatus } from './patient.schema';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
    constructor(private readonly patientsService: PatientsService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new patient' })
    @ApiResponse({ status: 409, description: 'Email already used by another patient' })
    create(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @Body() dto: CreatePatientDto,
    ) {
        return this.patientsService.create(clinicId, dto, new Types.ObjectId(userId));
    }

    @Get()
    @ApiOperation({ summary: 'List patients with pagination, search, filters and sorting' })
    findAll(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Query() query: QueryPatientDto,
    ) {
        return this.patientsService.findAll(clinicId, query);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get patient statistics for the clinic' })
    getStats(@CurrentUser('clinicId') clinicId: Types.ObjectId) {
        return this.patientsService.getPatientStats(clinicId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get patient by ID' })
    findById(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.patientsService.findById(clinicId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update patient' })
    @ApiResponse({ status: 409, description: 'Email already used by another patient' })
    update(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdatePatientDto,
    ) {
        return this.patientsService.update(clinicId, id, dto, new Types.ObjectId(userId));
    }

    @Patch(':id/status')
    @ApiOperation({
        summary: 'Change patient status (active / inactive / archived / deceased)',
    })
    updateStatus(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdatePatientStatusDto,
    ) {
        return this.patientsService.updateStatus(
            clinicId,
            id,
            dto.status,
            new Types.ObjectId(userId),
            dto.reason,
        );
    }

    @Patch(':id/restore')
    @ApiOperation({ summary: 'Reactivate a patient' })
    restore(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.patientsService.updateStatus(
            clinicId,
            id,
            PatientStatus.ACTIVE,
            new Types.ObjectId(userId),
        );
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Deactivate patient (soft delete)' })
    deactivate(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.patientsService.deactivate(clinicId, id, new Types.ObjectId(userId));
    }
}
