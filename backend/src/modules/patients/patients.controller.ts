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
    MedicalHistoryDto,
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
        @Body() dto: CreatePatientDto,
    ) {
        return this.patientsService.create(clinicId, dto);
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
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdatePatientDto,
    ) {
        return this.patientsService.update(clinicId, id, dto);
    }

    @Patch(':id/status')
    @ApiOperation({
        summary: 'Change patient status (active / inactive / archived / deceased)',
    })
    updateStatus(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdatePatientStatusDto,
    ) {
        return this.patientsService.updateStatus(clinicId, id, dto.status);
    }

    @Patch(':id/restore')
    @ApiOperation({ summary: 'Reactivate a patient' })
    restore(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.patientsService.updateStatus(clinicId, id, PatientStatus.ACTIVE);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Deactivate patient (soft delete)' })
    deactivate(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.patientsService.deactivate(clinicId, id);
    }

    @Patch(':id/medical-history')
    @ApiOperation({ summary: 'Update patient medical history' })
    updateMedicalHistory(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: MedicalHistoryDto,
    ) {
        return this.patientsService.updateMedicalHistory(clinicId, id, dto);
    }
}
