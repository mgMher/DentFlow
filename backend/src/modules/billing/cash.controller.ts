import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from 'src/common/decorators';
import { CashService } from './cash.service';
import { CashReportQueryDto, CloseDayDto, DebtorsQueryDto } from './dto/cash.dto';
import { BILLING_ADMINS, BILLING_EDITORS } from './billing.controller';

const oid = (id: string) => new Types.ObjectId(id);

/** F5: the day's money and the debtors list — for the people who take payments. */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class CashController {
    constructor(private readonly cash: CashService) {}

    @Get('cash-report')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: "A clinic day's money: received and refunded by method and cashier, expected cash, closing" })
    report(@CurrentUser('clinicId') clinicId: string, @Query() query: CashReportQueryDto) {
        return this.cash.report(oid(clinicId), query);
    }

    @Post('cash-report/close')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Close a day with the cash counted in the drawer' })
    close(@CurrentUser() user: { userId: string; clinicId: string }, @Body() dto: CloseDayDto) {
        return this.cash.close(oid(user.clinicId), oid(user.userId), dto);
    }

    @Delete('cash-report/:date/close')
    @Roles(...BILLING_ADMINS)
    @ApiOperation({ summary: 'Reopen a closed day (admins)' })
    reopen(@CurrentUser('clinicId') clinicId: string, @Param('date') date: string) {
        return this.cash.reopen(oid(clinicId), date);
    }

    @Get('debtors')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Patients who owe money (open invoices minus credit), by age of debt' })
    debtors(@CurrentUser('clinicId') clinicId: string, @Query() query: DebtorsQueryDto) {
        return this.cash.debtors(oid(clinicId), query);
    }
}
