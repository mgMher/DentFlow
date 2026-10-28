import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';
import { AppointmentsService } from './appointments.service';
import {
    CalendarQueryDto,
    CancelAppointmentDto,
    CreateAppointmentDto,
    CreateRecurringAppointmentDto,
    QueryAppointmentDto,
    UpdateAppointmentDto,
    UpdateAppointmentStatusDto,
} from './dto';

interface AuthUser {
    userId: string;
    clinicId: string;
    role: string;
}

/** Who books and runs appointments. Assistants see the schedule but don't change it. */
const BOOKERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST];

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
    constructor(private readonly appointmentsService: AppointmentsService) {}

    @Post()
    @Roles(...BOOKERS)
    @ApiOperation({ summary: 'Book an appointment' })
    @ApiResponse({ status: 409, description: 'Dentist, room or patient already booked; blocked time; outside hours' })
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
        return this.appointmentsService.create(user.clinicId, dto);
    }

    @Post('recurring')
    @Roles(...BOOKERS)
    @ApiOperation({ summary: 'Book a recurring series (returns created and skipped dates)' })
    createRecurring(@CurrentUser() user: AuthUser, @Body() dto: CreateRecurringAppointmentDto) {
        return this.appointmentsService.createRecurring(user.clinicId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List appointments (date range overlap, filters, pagination)' })
    findAll(@CurrentUser() user: AuthUser, @Query() query: QueryAppointmentDto) {
        return this.appointmentsService.findAll(user.clinicId, query);
    }

    @Get('today')
    @ApiOperation({ summary: "Today's appointments (clinic calendar day)" })
    getToday(@CurrentUser() user: AuthUser) {
        return this.appointmentsService.getTodayAppointments(user.clinicId);
    }

    @Get('calendar')
    @ApiOperation({ summary: 'All appointments in a date range, same shape as the list' })
    getCalendar(@CurrentUser() user: AuthUser, @Query() query: CalendarQueryDto) {
        return this.appointmentsService.getCalendarData(user.clinicId, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get appointment by ID' })
    findById(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.appointmentsService.findById(user.clinicId, id);
    }

    @Patch(':id')
    @Roles(...BOOKERS)
    @ApiOperation({ summary: 'Reschedule or edit an upcoming appointment' })
    update(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateAppointmentDto,
    ) {
        return this.appointmentsService.update(user.clinicId, id, dto);
    }

    @Patch(':id/status')
    @Roles(...BOOKERS)
    @ApiOperation({ summary: 'Move the appointment along its lifecycle' })
    updateStatus(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateAppointmentStatusDto,
    ) {
        return this.appointmentsService.updateStatus(user.clinicId, id, dto.status);
    }

    @Patch(':id/cancel')
    @Roles(...BOOKERS)
    @ApiOperation({ summary: 'Cancel with a reason (optionally the rest of its series)' })
    cancel(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: CancelAppointmentDto,
    ) {
        return this.appointmentsService.cancel(user.clinicId, id, dto, user.userId);
    }
}
