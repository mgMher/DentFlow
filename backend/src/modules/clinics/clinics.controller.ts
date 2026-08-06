import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ClinicsService } from './clinics.service';
import { UpdateClinicDto, UpdateWorkingHoursDto, UpdateSettingsDto } from './dto';

@ApiTags('Clinics')
@ApiBearerAuth()
@Controller('clinics')
export class ClinicsController {
    constructor(private readonly clinicsService: ClinicsService) {}

    @Get('current')
    @ApiOperation({ summary: 'Get the current clinic' })
    @ApiResponse({ status: 200, description: 'Current clinic returned' })
    async getCurrent(@CurrentUser('clinicId') clinicId: string) {
        return this.clinicsService.getClinic(clinicId);
    }

    @Patch('current')
    @Roles(Role.CLINIC_ADMIN)
    @ApiOperation({ summary: 'Update the current clinic' })
    @ApiResponse({ status: 200, description: 'Clinic updated' })
    @ApiResponse({ status: 404, description: 'Clinic not found' })
    async updateCurrent(
        @CurrentUser('clinicId') clinicId: string,
        @Body() dto: UpdateClinicDto,
    ) {
        return this.clinicsService.updateClinic(clinicId, dto);
    }

    @Patch('current/working-hours')
    @Roles(Role.CLINIC_ADMIN)
    @ApiOperation({ summary: 'Update the working hours of the current clinic' })
    @ApiResponse({ status: 200, description: 'Working hours updated' })
    @ApiResponse({ status: 404, description: 'Clinic not found' })
    async updateWorkingHours(
        @CurrentUser('clinicId') clinicId: string,
        @Body() dto: UpdateWorkingHoursDto,
    ) {
        return this.clinicsService.updateWorkingHours(clinicId, dto);
    }

    @Patch('current/settings')
    @Roles(Role.CLINIC_ADMIN)
    @ApiOperation({ summary: 'Update clinic settings (language, currency, timezone)' })
    @ApiResponse({ status: 200, description: 'Settings updated' })
    @ApiResponse({ status: 404, description: 'Clinic not found' })
    async updateSettings(
        @CurrentUser('clinicId') clinicId: string,
        @Body() dto: UpdateSettingsDto,
    ) {
        return this.clinicsService.updateSettings(clinicId, dto);
    }
}
