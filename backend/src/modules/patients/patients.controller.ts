import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { errorBody } from 'src/common/utils';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { PatientsService } from './patients.service';
import {
    CreatePatientDto,
    DuplicatePatientQueryDto,
    QueryPatientDto,
    UpdatePatientDto,
    UpdatePatientStatusDto,
} from './dto';

/**
 * Who may do what with patient records. Assistants read only. Receptionists
 * register patients and keep their contact details current, but medical
 * history and lifecycle status (archive, deceased) are clinical decisions.
 */
const PATIENT_EDITORS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST];
const CLINICAL_EDITORS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
    constructor(private readonly patientsService: PatientsService) {}

    @Post()
    @Roles(...PATIENT_EDITORS)
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

    @Get('duplicates')
    @ApiOperation({ summary: 'Patients who may be the same person (name + date of birth, phone or email)' })
    findDuplicates(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Query() query: DuplicatePatientQueryDto,
    ) {
        return this.patientsService.findPossibleDuplicates(new Types.ObjectId(clinicId.toString()), query);
    }

    @Get(':id/upcoming-appointments')
    @ApiOperation({ summary: 'Count of booked appointments still ahead for this patient' })
    countUpcoming(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.patientsService.countUpcomingAppointments(clinicId, id);
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
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'Update patient' })
    @ApiResponse({ status: 403, description: 'Receptionists cannot change medical history' })
    update(
        @CurrentUser('clinicId') clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @CurrentUser('role') role: Role,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdatePatientDto,
    ) {
        if (dto.medicalHistory !== undefined && !CLINICAL_EDITORS.includes(role)) {
            throw new ForbiddenException(
                errorBody('medicalHistoryForbidden', 'Only dentists and administrators can change medical history'),
            );
        }
        return this.patientsService.update(clinicId, id, dto, new Types.ObjectId(userId));
    }

    @Patch(':id/status')
    @Roles(...CLINICAL_EDITORS)
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
            dto.cancelUpcomingAppointments,
        );
    }
}
