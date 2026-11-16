import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Types } from 'mongoose';
import { CurrentUser, Platform, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { PlatformService } from './platform.service';
import { CreatePlatformAdminDto, PlatformAuditQueryDto, QueryClinicsDto, SuspendClinicDto, UpdateSubscriptionDto } from './dto/platform.dto';

/**
 * F13: the platform console, for platform admins only (accounts without a
 * clinic). Every write is in the platform log, and — when it is about a
 * clinic — in that clinic's own log too.
 */
@ApiTags('Platform')
@ApiBearerAuth()
@Controller('platform')
@Platform()
@Roles(Role.SUPER_ADMIN)
export class PlatformController {
    constructor(private readonly platform: PlatformService) {}

    @Get('clinics')
    @ApiOperation({ summary: 'Every clinic with its state, plan, end date and use' })
    listClinics(@Query() query: QueryClinicsDto) {
        return this.platform.listClinics(query);
    }

    @Get('clinics/:clinicId')
    @ApiOperation({ summary: 'One clinic: details, use, admins' })
    clinic(@Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId) {
        return this.platform.clinic(clinicId);
    }

    @Patch('clinics/:clinicId/subscription')
    @ApiOperation({ summary: 'Plan, status and last day of access (null: no end)' })
    updateSubscription(@Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId, @Body() dto: UpdateSubscriptionDto) {
        return this.platform.updateSubscription(clinicId, dto);
    }

    @Post('clinics/:clinicId/suspend')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Suspend: nobody in the clinic can sign in; everyone is signed out' })
    suspend(@Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId, @Body() dto: SuspendClinicDto) {
        return this.platform.suspend(clinicId, dto.reason);
    }

    @Post('clinics/:clinicId/reactivate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Lift a suspension' })
    reactivate(@Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId) {
        return this.platform.reactivate(clinicId);
    }

    @Post('clinics/:clinicId/users/:userId/password-reset')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Email a clinic admin a password-reset link' })
    sendPasswordReset(
        @Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId,
        @Param('userId', ParseObjectIdPipe) userId: Types.ObjectId,
    ) {
        return this.platform.sendPasswordReset(clinicId, userId);
    }

    @Post('clinics/:clinicId/users/:userId/reset-two-factor')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Turn off a clinic admin's two-factor (lost phone); they set it up again" })
    resetTwoFactor(
        @Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId,
        @Param('userId', ParseObjectIdPipe) userId: Types.ObjectId,
    ) {
        return this.platform.resetTwoFactor(clinicId, userId);
    }

    @Post('clinics/:clinicId/support-session')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'A read-only view of the clinic, while its admin allows support access' })
    startSupport(
        @Param('clinicId', ParseObjectIdPipe) clinicId: Types.ObjectId,
        @CurrentUser('userId') userId: string,
        @Req() req: Request,
    ) {
        return this.platform.startSupport(clinicId, userId, { userAgent: req.headers['user-agent'], ip: req.ip });
    }

    @Get('audit')
    @ApiOperation({ summary: "Platform admins' actions and support views, and sign-ins in every clinic" })
    audit(@Query() query: PlatformAuditQueryDto) {
        return this.platform.audit(query);
    }

    @Get('admins')
    @ApiOperation({ summary: 'Platform admins' })
    admins() {
        return this.platform.admins();
    }

    @Post('admins')
    @ApiOperation({ summary: 'Add a platform admin; they choose a password from an emailed link' })
    addAdmin(@Body() dto: CreatePlatformAdminDto) {
        return this.platform.addAdmin(dto);
    }

    @Delete('admins/:id')
    @ApiOperation({ summary: 'Remove a platform admin (not yourself, not the last one)' })
    removeAdmin(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @CurrentUser('userId') userId: string) {
        return this.platform.removeAdmin(id, userId);
    }
}
