import {
    Body,
    Controller,
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
import { DentalRecordsService } from './dental-records.service';
import { UpdateToothDto, CreateTreatmentEntryDto, QueryRecordsDto } from './dto';

@ApiTags('Dental Records')
@ApiBearerAuth()
@Controller('dental-records')
export class DentalRecordsController {
    constructor(private readonly dentalRecordsService: DentalRecordsService) {}

    @Get(':patientId/chart')
    @ApiOperation({ summary: 'Get dental chart for a patient (creates if not exists)' })
    @ApiResponse({ status: 200, description: 'Dental chart returned' })
    async getChart(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @CurrentUser('clinicId') clinicId: string,
        @Query('chartType') chartType?: 'adult' | 'pediatric',
    ) {
        return this.dentalRecordsService.getOrCreateChart(
            new Types.ObjectId(clinicId),
            patientId,
            chartType,
        );
    }

    @Patch(':patientId/tooth')
    @ApiOperation({ summary: 'Update a single tooth status in the dental chart' })
    @ApiResponse({ status: 200, description: 'Tooth updated' })
    @ApiResponse({ status: 404, description: 'Tooth number not found in chart' })
    async updateTooth(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Body() dto: UpdateToothDto,
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.updateTooth(
            new Types.ObjectId(clinicId),
            patientId,
            dto,
            new Types.ObjectId(userId),
        );
    }

    @Patch(':patientId/teeth')
    @ApiOperation({ summary: 'Batch update multiple teeth in the dental chart' })
    @ApiResponse({ status: 200, description: 'Teeth updated' })
    @ApiResponse({ status: 404, description: 'One or more tooth numbers not found in chart' })
    async updateMultipleTeeth(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Body() teeth: UpdateToothDto[],
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.updateMultipleTeeth(
            new Types.ObjectId(clinicId),
            patientId,
            teeth,
            new Types.ObjectId(userId),
        );
    }

    @Post(':patientId/treatment-entry')
    @ApiOperation({ summary: 'Add a treatment entry for a specific tooth' })
    @ApiResponse({ status: 201, description: 'Treatment entry created' })
    async addTreatmentEntry(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Body() dto: CreateTreatmentEntryDto,
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.addTreatmentEntry(
            new Types.ObjectId(clinicId),
            patientId,
            new Types.ObjectId(userId),
            dto,
        );
    }

    @Get(':patientId/treatment-history')
    @ApiOperation({ summary: 'Get treatment history for a patient (optional tooth filter)' })
    @ApiResponse({ status: 200, description: 'Treatment history returned' })
    async getTreatmentHistory(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Query() query: QueryRecordsDto,
        @CurrentUser('clinicId') clinicId: string,
    ) {
        return this.dentalRecordsService.getTreatmentHistory(
            new Types.ObjectId(clinicId),
            patientId,
            query,
        );
    }

    @Get(':patientId/summary')
    @ApiOperation({ summary: 'Get dental health summary for a patient' })
    @ApiResponse({ status: 200, description: 'Dental summary returned' })
    async getPatientDentalSummary(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @CurrentUser('clinicId') clinicId: string,
    ) {
        return this.dentalRecordsService.getPatientDentalSummary(
            new Types.ObjectId(clinicId),
            patientId,
        );
    }
}
