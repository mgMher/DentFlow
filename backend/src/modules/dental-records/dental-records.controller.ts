import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { DentalRecordsService } from './dental-records.service';
import {
    UpdateToothDto,
    UpdateTeethDto,
    SetChartTypeDto,
    GetChartQueryDto,
    CreateTreatmentEntryDto,
    CompleteTreatmentEntryDto,
    VoidTreatmentEntryDto,
    QueryRecordsDto,
} from './dto';

/** Role matrix (D5): the chart and treatment entries are clinical records. Everyone else views. */
const CHART_EDITORS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];

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
        @Query() query: GetChartQueryDto,
    ) {
        return this.dentalRecordsService.getChart(new Types.ObjectId(clinicId), patientId, query.chartType);
    }

    @Patch(':patientId/chart-type')
    @Roles(...CHART_EDITORS)
    @ApiOperation({
        summary: 'Switch a chart between permanent and primary teeth',
        description: 'The current teeth are archived; switching back restores them. Treatment entries are untouched.',
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
    @Roles(...CHART_EDITORS)
    @ApiOperation({ summary: 'Update one tooth (status, surfaces, notes)' })
    @ApiResponse({ status: 200, description: 'Tooth updated' })
    @ApiResponse({ status: 404, description: 'Tooth number not on this chart' })
    @ApiResponse({ status: 409, description: 'Chart changed by someone else (chartChanged)' })
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
    @Roles(...CHART_EDITORS)
    @ApiOperation({ summary: 'Batch update multiple teeth in the dental chart' })
    @ApiResponse({ status: 200, description: 'Teeth updated' })
    @ApiResponse({ status: 404, description: 'One or more tooth numbers not on this chart' })
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
    @ApiOperation({ summary: 'Get the full timeline of one tooth (status changes + treatments)' })
    @ApiResponse({ status: 200, description: 'Tooth history returned' })
    async getToothHistory(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Param('toothNumber', ParseIntPipe) toothNumber: number,
        @CurrentUser('clinicId') clinicId: string,
    ) {
        return this.dentalRecordsService.getToothHistory(new Types.ObjectId(clinicId), patientId, toothNumber);
    }

    @Post(':patientId/treatment-entry')
    @Roles(...CHART_EDITORS)
    @ApiOperation({
        summary: 'Record a treatment (done or planned), on zero, one or several teeth',
        description: 'A done treatment with a result status updates the chart.',
    })
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

    @Patch(':patientId/treatment-entry/:entryId/complete')
    @Roles(...CHART_EDITORS)
    @ApiOperation({ summary: 'Mark a planned treatment as done (updates the chart)' })
    @ApiResponse({ status: 200, description: 'Entry done' })
    @ApiResponse({ status: 400, description: 'Already done or voided' })
    async completeTreatmentEntry(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Param('entryId', ParseObjectIdPipe) entryId: Types.ObjectId,
        @Body() dto: CompleteTreatmentEntryDto,
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.completeTreatmentEntry(
            new Types.ObjectId(clinicId),
            patientId,
            entryId,
            new Types.ObjectId(userId),
            dto,
        );
    }

    @Patch(':patientId/treatment-entry/:entryId/void')
    @Roles(...CHART_EDITORS)
    @ApiOperation({ summary: 'Void a treatment entry (kept, hidden from history, with a reason)' })
    @ApiResponse({ status: 200, description: 'Entry voided' })
    async voidTreatmentEntry(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Param('entryId', ParseObjectIdPipe) entryId: Types.ObjectId,
        @Body() dto: VoidTreatmentEntryDto,
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
    ) {
        return this.dentalRecordsService.voidTreatmentEntry(
            new Types.ObjectId(clinicId),
            patientId,
            entryId,
            new Types.ObjectId(userId),
            dto.reason,
        );
    }

    @Get(':patientId/treatment-history')
    @ApiOperation({ summary: 'Treatment history for a patient (filters: tooth, status, dates, voided)' })
    @ApiResponse({ status: 200, description: 'Treatment history returned' })
    async getTreatmentHistory(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Query() query: QueryRecordsDto,
        @CurrentUser('clinicId') clinicId: string,
    ) {
        return this.dentalRecordsService.getTreatmentHistory(new Types.ObjectId(clinicId), patientId, query);
    }

    @Get(':patientId/summary')
    @ApiOperation({ summary: 'Get dental health summary for a patient' })
    @ApiResponse({ status: 200, description: 'Dental summary returned' })
    async getPatientDentalSummary(
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @CurrentUser('clinicId') clinicId: string,
    ) {
        return this.dentalRecordsService.getPatientDentalSummary(new Types.ObjectId(clinicId), patientId);
    }
}
