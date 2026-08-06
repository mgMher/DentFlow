import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { AppointmentStatus } from './appointment.schema';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, QueryAppointmentDto, UpdateAppointmentDto } from './dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new appointment' })
    @Roles(Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST)
    async create(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Body() dto: CreateAppointmentDto,
    ) {
        return this.appointmentsService.create(user.clinicId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List appointments with optional filters' })
    async findAll(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query() query: QueryAppointmentDto,
    ) {
        return this.appointmentsService.findAll(user.clinicId, query);
    }

    @Get('today')
    @ApiOperation({ summary: "Get today's appointments" })
    async getTodayAppointments(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
    ) {
        return this.appointmentsService.getTodayAppointments(user.clinicId);
    }

    @Get('calendar')
    @ApiOperation({ summary: 'Get appointments for calendar view' })
    @ApiQuery({ name: 'startDate', required: true, type: String })
    @ApiQuery({ name: 'endDate', required: true, type: String })
    @ApiQuery({ name: 'dentistId', required: false, type: String })
    async getCalendarData(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('dentistId') dentistId?: string,
    ) {
        return this.appointmentsService.getCalendarData(
            user.clinicId,
            startDate,
            endDate,
            dentistId,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get appointment by ID' })
    async findById(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
    ) {
        return this.appointmentsService.findById(user.clinicId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an appointment' })
    @Roles(Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST)
    async update(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
        @Body() dto: UpdateAppointmentDto,
    ) {
        return this.appointmentsService.update(user.clinicId, id, dto);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update appointment status only' })
    @Roles(Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST)
    async updateStatus(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
        @Body('status') status: AppointmentStatus,
    ) {
        return this.appointmentsService.updateStatus(user.clinicId, id, status);
    }

    @Patch(':id/cancel')
    @ApiOperation({ summary: 'Cancel an appointment' })
    @Roles(Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST)
    async cancel(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
        @Body('reason') reason?: string,
    ) {
        return this.appointmentsService.cancel(user.clinicId, id, reason);
    }

    @Post('recurring')
    @ApiOperation({ summary: 'Create a recurring appointment series' })
    @Roles(Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST)
    async createRecurring(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Body() dto: CreateAppointmentDto,
    ) {
        return this.appointmentsService.createRecurring(user.clinicId, dto);
    }
}
