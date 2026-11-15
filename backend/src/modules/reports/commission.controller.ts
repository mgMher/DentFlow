import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { MonthPipe } from './month.pipe';
import { CommissionService } from './commission.service';
import { SetCommissionRatesDto } from './dto/commission.dto';

const ADMINS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN];
const oid = (id: string) => new Types.ObjectId(id);
type AuthUser = { userId: string; clinicId: string; role: Role };

/** F11: dentist commission. Admins see and approve every dentist; a dentist sees their own. */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('commission')
export class CommissionController {
    constructor(private readonly commission: CommissionService) {}

    @Get('rates')
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Default commission % and per-dentist overrides' })
    rates(@CurrentUser('clinicId') clinicId: string) {
        return this.commission.rates(oid(clinicId));
    }

    @Put('rates')
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Set the default % and / or dentists\' own % (null = default)' })
    setRates(@CurrentUser('clinicId') clinicId: string, @Body() dto: SetCommissionRatesDto) {
        return this.commission.setRates(oid(clinicId), dto);
    }

    @Get(':month')
    @Roles(...ADMINS, Role.DENTIST)
    @ApiOperation({ summary: 'A month (YYYY-MM): approved or live; dentists get their own row' })
    statement(@CurrentUser() user: AuthUser, @Param('month', MonthPipe) month: string) {
        return this.commission.statement({ clinicId: oid(user.clinicId), userId: oid(user.userId), role: user.role }, month);
    }

    @Post(':month/approve')
    @HttpCode(HttpStatus.OK)
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Approve (freeze) an ended month' })
    approve(@CurrentUser('clinicId') clinicId: string, @CurrentUser('userId') userId: string, @Param('month', MonthPipe) month: string) {
        return this.commission.approve(oid(clinicId), month, oid(userId));
    }

    @Delete(':month/approve')
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Reopen the latest approved month' })
    reopen(@CurrentUser('clinicId') clinicId: string, @Param('month', MonthPipe) month: string) {
        return this.commission.reopen(oid(clinicId), month);
    }
}
