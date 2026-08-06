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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { PatientsService } from './patients.service';
import { CreatePatientDto, QueryPatientDto, UpdatePatientDto } from './dto';
import { MedicalHistoryDto } from './dto/create-patient.dto';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
    constructor(private readonly patientsService: PatientsService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new patient' })
    create(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Body() dto: CreatePatientDto,
    ) {
        return this.patientsService.create(clinicId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List patients with pagination and search' })
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
    update(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdatePatientDto,
    ) {
        return this.patientsService.update(clinicId, id, dto);
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
