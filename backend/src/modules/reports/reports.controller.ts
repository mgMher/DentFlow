import {
    Controller,
    Get,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(Role.CLINIC_ADMIN, Role.DENTIST)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get('dashboard')
    @ApiOperation({ summary: 'Get dashboard summary' })
    getDashboardSummary(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
    ) {
        return this.reportsService.getDashboardSummary(user.clinicId);
    }

    @Get('patients')
    @ApiOperation({ summary: 'Get patient statistics' })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getPatientStats(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getPatientStats(user.clinicId, startDate, endDate);
    }

    @Get('revenue')
    @ApiOperation({ summary: 'Get revenue report' })
    @ApiQuery({ name: 'startDate', required: true, type: String })
    @ApiQuery({ name: 'endDate', required: true, type: String })
    @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'] })
    getRevenueReport(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
    ) {
        return this.reportsService.getRevenueReport(
            user.clinicId,
            startDate,
            endDate,
            groupBy,
        );
    }

    @Get('appointments')
    @ApiOperation({ summary: 'Get appointment statistics' })
    @ApiQuery({ name: 'startDate', required: true, type: String })
    @ApiQuery({ name: 'endDate', required: true, type: String })
    getAppointmentStats(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.getAppointmentStats(
            user.clinicId,
            startDate,
            endDate,
        );
    }

    @Get('dentist-performance')
    @ApiOperation({ summary: 'Get dentist performance metrics' })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getDentistPerformance(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getDentistPerformance(
            user.clinicId,
            startDate,
            endDate,
        );
    }

    @Get('treatments')
    @ApiOperation({ summary: 'Get treatment statistics' })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getTreatmentStats(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getTreatmentStats(
            user.clinicId,
            startDate,
            endDate,
        );
    }
}
