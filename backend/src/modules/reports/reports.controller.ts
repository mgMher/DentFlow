import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ReportQueryDto } from './dto';
import { REVENUE_ROLES, ReportsService, ReportViewer } from './reports.service';

/** Role matrix (D5): admins see everything, dentists their own performance without money. */
const REPORT_VIEWERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];
/** The dashboard is every role's landing page. */
const ALL_STAFF = [...REPORT_VIEWERS, Role.RECEPTIONIST, Role.ASSISTANT];

type AuthUser = { userId: string; clinicId: string; role: Role };

const viewerOf = (user: AuthUser): ReportViewer => ({
    clinicId: new Types.ObjectId(user.clinicId),
    userId: new Types.ObjectId(user.userId),
    role: user.role,
});

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(...REPORT_VIEWERS)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get('dashboard')
    @Roles(...ALL_STAFF)
    @ApiOperation({ summary: "Dashboard: today's appointments, patients, open invoices, month revenue (by role)" })
    getDashboard(@CurrentUser() user: AuthUser) {
        return this.reportsService.getDashboard(viewerOf(user));
    }

    @Get('revenue')
    @Roles(...REVENUE_ROLES)
    @ApiOperation({ summary: 'Collected payments per period and method, invoiced, outstanding (clinic currency)' })
    getRevenue(@CurrentUser('clinicId') clinicId: string, @Query() query: ReportQueryDto) {
        return this.reportsService.getRevenue(new Types.ObjectId(clinicId), query);
    }

    @Get('appointments')
    @ApiOperation({ summary: 'Appointments by status and outcome rates (dentists: own)' })
    getAppointmentStats(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
        return this.reportsService.getAppointmentStats(viewerOf(user), query);
    }

    @Get('dentist-performance')
    @ApiOperation({ summary: 'Per dentist: appointments, treatments done, collected (dentists: own row, no money)' })
    getDentistPerformance(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
        return this.reportsService.getDentistPerformance(viewerOf(user), query);
    }

    @Get('treatments')
    @ApiOperation({ summary: 'Treatments done and collected per treatment (dentists: own, no money)' })
    getTreatmentStats(@CurrentUser() user: AuthUser, @Query() query: ReportQueryDto) {
        return this.reportsService.getTreatmentStats(viewerOf(user), query);
    }

    @Get('patients')
    @ApiOperation({ summary: 'Patients: total, active, registered in the range' })
    getPatientStats(@CurrentUser('clinicId') clinicId: string, @Query() query: ReportQueryDto) {
        return this.reportsService.getPatientStats(new Types.ObjectId(clinicId), query);
    }
}
