import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { BillingService } from './billing.service';
import {
    CreateInvoiceDto,
    UpdateInvoiceDto,
    CreatePaymentDto,
    QueryInvoiceDto,
    VoidPaymentDto,
    CancelInvoiceDto,
} from './dto';

/** Role matrix (D5): dentists view billing, assistants have none. */
const BILLING_VIEWERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.RECEPTIONIST, Role.DENTIST];
/** Create, edit, issue, take payments, cancel drafts. */
const BILLING_EDITORS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.RECEPTIONIST];
/** Refunds (cancelling an issued invoice is checked in the service). Revenue lives in /reports/revenue. */
const BILLING_ADMINS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN];

type AuthUser = { userId: string; clinicId: string; role: Role };

@ApiTags('Billing')
@ApiBearerAuth()
@Roles(...BILLING_VIEWERS)
@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) {}

    @Post('invoices')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Create an invoice (draft, or issued with `issue: true`)' })
    @ApiResponse({ status: 201, description: 'Invoice created' })
    @ApiResponse({ status: 409, description: 'A treatment line is already billed (treatmentAlreadyBilled)' })
    async createInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
        return this.billingService.createInvoice(
            new Types.ObjectId(user.clinicId),
            new Types.ObjectId(user.userId),
            dto,
        );
    }

    @Get('invoices')
    @ApiOperation({ summary: 'List invoices (status incl. overdue, patient, search, dates, pages)' })
    @ApiResponse({ status: 200, description: 'Paginated invoice list' })
    async findAllInvoices(@CurrentUser('clinicId') clinicId: string, @Query() query: QueryInvoiceDto) {
        return this.billingService.findAllInvoices(new Types.ObjectId(clinicId), query);
    }

    @Get('invoices/:id')
    @ApiOperation({ summary: 'Get a single invoice' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async findInvoiceById(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
    ) {
        return this.billingService.findInvoiceById(new Types.ObjectId(clinicId), invoiceId);
    }

    @Patch('invoices/:id')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Update a draft invoice' })
    @ApiResponse({ status: 400, description: 'Not a draft' })
    async updateInvoice(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
        @Body() dto: UpdateInvoiceDto,
    ) {
        return this.billingService.updateInvoice(new Types.ObjectId(clinicId), invoiceId, dto);
    }

    @Patch('invoices/:id/issue')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Issue a draft invoice (it can then take payments)' })
    async issueInvoice(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
    ) {
        return this.billingService.issueInvoice(
            new Types.ObjectId(user.clinicId),
            invoiceId,
            new Types.ObjectId(user.userId),
        );
    }

    @Patch('invoices/:id/cancel')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({
        summary: 'Cancel an invoice with nothing paid',
        description: 'Drafts: anyone who bills. Issued: clinic admin only. Paid amounts must be refunded first.',
    })
    @ApiResponse({ status: 400, description: 'Has payments (invoiceHasPayments) or already cancelled' })
    @ApiResponse({ status: 403, description: 'Issued invoice and not admin (cancelIssuedForbidden)' })
    async cancelInvoice(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
        @Body() dto: CancelInvoiceDto,
    ) {
        return this.billingService.cancelInvoice(
            new Types.ObjectId(user.clinicId),
            invoiceId,
            new Types.ObjectId(user.userId),
            user.role,
            dto.reason,
        );
    }

    @Post('invoices/:id/payments')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Record a payment (issued invoices, at most the balance, invoice currency)' })
    @ApiResponse({ status: 201, description: 'Payment recorded; returns the payment and the updated invoice' })
    @ApiResponse({ status: 400, description: 'Exceeds balance, wrong currency, draft, paid or cancelled' })
    async addPayment(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
        @Body() dto: CreatePaymentDto,
    ) {
        return this.billingService.addPayment(
            new Types.ObjectId(user.clinicId),
            invoiceId,
            new Types.ObjectId(user.userId),
            dto,
        );
    }

    @Get('invoices/:id/payments')
    @ApiOperation({ summary: 'Payments of an invoice, voided ones included (marked)' })
    async getPaymentsByInvoice(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
    ) {
        return this.billingService.getPaymentsByInvoice(new Types.ObjectId(clinicId), invoiceId);
    }

    @Patch('invoices/:id/payments/:paymentId/void')
    @Roles(...BILLING_ADMINS)
    @ApiOperation({ summary: 'Refund or void a payment (admin); the invoice balance goes back up' })
    async voidPayment(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) invoiceId: Types.ObjectId,
        @Param('paymentId', ParseObjectIdPipe) paymentId: Types.ObjectId,
        @Body() dto: VoidPaymentDto,
    ) {
        return this.billingService.voidPayment(
            new Types.ObjectId(user.clinicId),
            invoiceId,
            paymentId,
            new Types.ObjectId(user.userId),
            dto,
        );
    }

    @Get('patients/:patientId/summary')
    @ApiOperation({ summary: "A patient's billed / paid / balance per currency, and unbilled treatments" })
    async getPatientSummary(
        @CurrentUser('clinicId') clinicId: string,
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
    ) {
        return this.billingService.getPatientSummary(new Types.ObjectId(clinicId), patientId);
    }

    @Get('patients/:patientId/unbilled-treatments')
    @ApiOperation({ summary: 'Done treatment entries not on a live invoice yet' })
    async getUnbilledTreatments(
        @CurrentUser('clinicId') clinicId: string,
        @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId,
    ) {
        return this.billingService.getUnbilledTreatments(new Types.ObjectId(clinicId), patientId);
    }
}
