import {
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @ApiOperation({ summary: 'List notifications for current user' })
    findAll(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Query() query: QueryNotificationDto,
    ) {
        return this.notificationsService.findAll(user.clinicId, user.userId, query);
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Get unread notification count for current user' })
    getUnreadCount(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
    ) {
        return this.notificationsService.getUnreadCount(user.clinicId, user.userId);
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark a notification as read' })
    markAsRead(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
    ) {
        return this.notificationsService.markAsRead(user.clinicId, id);
    }

    @Patch('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read for current user' })
    markAllAsRead(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
    ) {
        return this.notificationsService.markAllAsRead(user.clinicId, user.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a notification' })
    delete(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
    ) {
        return this.notificationsService.delete(user.clinicId, id);
    }
}
