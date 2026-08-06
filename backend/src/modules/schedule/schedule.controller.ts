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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ScheduleService } from './schedule.service';
import { CreateRoomDto, UpdateRoomDto, CreateBlockedTimeDto } from './dto';

@ApiTags('Schedule')
@ApiBearerAuth()
@Controller('schedule')
export class ScheduleController {
    constructor(private readonly scheduleService: ScheduleService) {}

    // ─── Treatment Rooms ──────────────────────────────────────────────

    @Get('rooms')
    @ApiOperation({ summary: 'List all treatment rooms' })
    getRooms(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
    ) {
        return this.scheduleService.getRooms(user.clinicId);
    }

    @Post('rooms')
    @ApiOperation({ summary: 'Create a new treatment room' })
    @Roles(Role.CLINIC_ADMIN)
    createRoom(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Body() dto: CreateRoomDto,
    ) {
        return this.scheduleService.createRoom(user.clinicId, dto);
    }

    @Patch('rooms/:id')
    @ApiOperation({ summary: 'Update a treatment room' })
    @Roles(Role.CLINIC_ADMIN)
    updateRoom(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
        @Body() dto: UpdateRoomDto,
    ) {
        return this.scheduleService.updateRoom(user.clinicId, id, dto);
    }

    @Delete('rooms/:id')
    @ApiOperation({ summary: 'Deactivate a treatment room (soft delete)' })
    @Roles(Role.CLINIC_ADMIN)
    deactivateRoom(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
    ) {
        return this.scheduleService.deactivateRoom(user.clinicId, id);
    }

    // ─── Blocked Times ────────────────────────────────────────────────

    @Get('blocked-times')
    @ApiOperation({ summary: 'List blocked times with optional filters' })
    @ApiQuery({ name: 'dentistId', required: false, type: String })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getBlockedTimes(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query('dentistId') dentistId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.scheduleService.getBlockedTimes(
            user.clinicId,
            dentistId,
            startDate,
            endDate,
        );
    }

    @Post('blocked-times')
    @ApiOperation({ summary: 'Create a blocked time slot' })
    createBlockedTime(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Body() dto: CreateBlockedTimeDto,
    ) {
        return this.scheduleService.createBlockedTime(user.clinicId, dto);
    }

    @Delete('blocked-times/:id')
    @ApiOperation({ summary: 'Delete a blocked time slot' })
    deleteBlockedTime(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
    ) {
        return this.scheduleService.deleteBlockedTime(user.clinicId, id);
    }

    // ─── Availability ─────────────────────────────────────────────────

    @Get('availability/:dentistId')
    @ApiOperation({ summary: 'Get available time slots for a dentist on a given date' })
    @ApiQuery({ name: 'date', required: true, type: String, description: 'Date in YYYY-MM-DD format' })
    getDentistAvailability(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('dentistId') dentistId: string,
        @Query('date') date: string,
    ) {
        return this.scheduleService.getDentistAvailability(
            user.clinicId,
            dentistId,
            date,
        );
    }
}
