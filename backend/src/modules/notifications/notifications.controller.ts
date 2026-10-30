import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto';

type AuthUser = { userId: string; clinicId: string };

/** Every route works on the caller's own notifications only. */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @ApiOperation({ summary: 'My notifications, newest first (isRead filter, pages); includes the unread count' })
    findAll(@CurrentUser() user: AuthUser, @Query() query: QueryNotificationDto) {
        return this.notificationsService.findAll(user.clinicId, user.userId, query);
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'How many of my notifications are unread (polled by the header bell)' })
    getUnreadCount(@CurrentUser() user: AuthUser) {
        return this.notificationsService.getUnreadCount(user.clinicId, user.userId);
    }

    @Patch('read-all')
    @ApiOperation({ summary: 'Mark all my notifications as read' })
    markAllAsRead(@CurrentUser() user: AuthUser) {
        return this.notificationsService.markAllAsRead(user.clinicId, user.userId);
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark one of my notifications as read' })
    markAsRead(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.notificationsService.markAsRead(user.clinicId, user.userId, id);
    }

    @Delete('read')
    @ApiOperation({ summary: 'Delete all my read notifications' })
    deleteRead(@CurrentUser() user: AuthUser) {
        return this.notificationsService.deleteRead(user.clinicId, user.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete one of my notifications' })
    delete(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.notificationsService.delete(user.clinicId, user.userId, id);
    }
}
