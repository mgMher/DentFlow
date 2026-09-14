import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { DentalRecordsService } from './dental-records.service';
import {
    UpdateToothDto,
    UpdateTeethDto,
    SetChartTypeDto,
    CreateTreatmentEntryDto,
    QueryRecordsDto,
} from './dto';

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

    @Patch(':patientId/chart-type')
    @ApiOperation({
        summary: 'Switch a chart between adult and pediatric numbering',
        description:
            'Rebuilds the teeth array for the new numbering. Per-tooth status and history do not carry over; treatment entries are preserved.',
    })
    @ApiResponse({ status: 200, description: 'Chart type updated' })
    async setChartType(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Body() dto: SetChartTypeDto,
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.setChartType(
            new Types.ObjectId(clinicId),
            patientId,
            dto.chartType,
            new Types.ObjectId(userId),
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
        @Body() dto: UpdateTeethDto,
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.updateMultipleTeeth(
            new Types.ObjectId(clinicId),
            patientId,
            dto.teeth,
            new Types.ObjectId(userId),
        );
    }

    @Get(':patientId/tooth/:toothNumber/history')
    @ApiOperation({
        summary: 'Get the full timeline of one tooth (status changes + treatments)',
    })
    @ApiResponse({ status: 200, description: 'Tooth history returned' })
    @ApiResponse({ status: 404, description: 'Tooth number not found in chart' })
    async getToothHistory(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Param('toothNumber', ParseIntPipe) toothNumber: number,
        @CurrentUser('clinicId') clinicId: string,
    ) {
        return this.dentalRecordsService.getToothHistory(
            new Types.ObjectId(clinicId),
            patientId,
            toothNumber,
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
