import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { AccountService } from './account.service';
import { ApplyCreditDto, TakePaymentDto } from './dto/account.dto';
import { VoidPaymentDto } from './dto';
import { BILLING_ADMINS, BILLING_EDITORS, BILLING_VIEWERS } from './billing.controller';

const oid = (id: string) => new Types.ObjectId(id);

/** F4: the patient's account — balance, credit, statement, one payment over several invoices. */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class AccountController {
    constructor(private readonly account: AccountService) {}

    @Get('patients/:patientId/account')
    @Roles(...BILLING_VIEWERS)
    @ApiOperation({ summary: 'Outstanding, credit and balance, with open invoices and unused credit' })
    getAccount(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId) {
        return this.account.getAccount(oid(clinicId), patientId);
    }

    @Get('patients/:patientId/family-account')
    @Roles(...BILLING_VIEWERS)
    @ApiOperation({ summary: 'The patient and the children they are the guardian of: accounts and totals (F8)' })
    familyAccount(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId) {
        return this.account.getFamilyAccount(oid(clinicId), patientId);
    }

    @Get('patients/:patientId/statement')
    @Roles(...BILLING_VIEWERS)
    @ApiOperation({ summary: 'Invoices, payments and refunds, oldest first, with a running balance' })
    getStatement(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId) {
        return this.account.getStatement(oid(clinicId), patientId);
    }

    @Post('patients/:patientId/payments')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Take money from a patient: over their open invoices (oldest first by default), the rest on account' })
    takePayment(
        @CurrentUser() user: { userId: string; clinicId: string },
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Body() dto: TakePaymentDto,
    ) {
        return this.account.takePayment(oid(user.clinicId), patientId, oid(user.userId), dto);
    }

    @Post('invoices/:id/apply-credit')
    @HttpCode(200)
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: "Pay an invoice from the patient's credit" })
    applyCredit(
        @CurrentUser() user: { userId: string; clinicId: string },
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
        @Body() dto: ApplyCreditDto,
    ) {
        return this.account.applyCredit(oid(user.clinicId), invoiceId, oid(user.userId), dto);
    }

    @Patch('patients/:patientId/credits/:paymentId/void')
    @Roles(...BILLING_ADMINS)
    @ApiOperation({ summary: 'Refund (or void as a mistake) money on account' })
    voidCredit(
        @CurrentUser() user: { userId: string; clinicId: string },
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
        @Param('paymentId', ParseObjectIdPipe) paymentId: Types.ObjectId,
        @Body() dto: VoidPaymentDto,
    ) {
        return this.account.voidCredit(oid(user.clinicId), patientId, paymentId, oid(user.userId), dto);
    }
}
