import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from 'src/common/decorators';
import { BillingService } from './billing.service';
import {
    CreateInvoiceDto,
    UpdateInvoiceDto,
    CreatePaymentDto,
    QueryInvoiceDto,
    QueryRevenueDto,
} from './dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) {}

    @Post('invoices')
    @ApiOperation({ summary: 'Create a new invoice' })
    @ApiResponse({ status: 201, description: 'Invoice created successfully' })
    @ApiResponse({ status: 400, description: 'Validation error' })
    async createInvoice(
        @CurrentUser() user: { userId: string; clinicId: string },
        @Body() dto: CreateInvoiceDto,
    ) {
        return this.billingService.createInvoice(
            new Types.ObjectId(user.clinicId),
            new Types.ObjectId(user.userId),
            dto,
        );
    }

    @Get('invoices')
    @ApiOperation({ summary: 'List invoices with filters and pagination' })
    @ApiResponse({ status: 200, description: 'Paginated invoice list' })
    async findAllInvoices(
        @CurrentUser('clinicId') clinicId: string,
        @Query() query: QueryInvoiceDto,
    ) {
        return this.billingService.findAllInvoices(
            new Types.ObjectId(clinicId),
            query,
        );
    }

    @Get('invoices/overdue')
    @ApiOperation({ summary: 'Get all overdue invoices' })
    @ApiResponse({ status: 200, description: 'List of overdue invoices' })
    async getOverdueInvoices(@CurrentUser('clinicId') clinicId: string) {
        return this.billingService.getOverdueInvoices(
            new Types.ObjectId(clinicId),
        );
    }

    @Get('invoices/:id')
    @ApiOperation({ summary: 'Get a single invoice by ID' })
    @ApiResponse({ status: 200, description: 'Invoice details' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async findInvoiceById(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id') invoiceId: string,
    ) {
        return this.billingService.findInvoiceById(
            new Types.ObjectId(clinicId),
            new Types.ObjectId(invoiceId),
        );
    }

    @Patch('invoices/:id')
    @ApiOperation({ summary: 'Update an invoice (draft status only)' })
    @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
    @ApiResponse({ status: 400, description: 'Invoice is not in draft status' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async updateInvoice(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id') invoiceId: string,
        @Body() dto: UpdateInvoiceDto,
    ) {
        return this.billingService.updateInvoice(
            new Types.ObjectId(clinicId),
            new Types.ObjectId(invoiceId),
            dto,
        );
    }

    @Patch('invoices/:id/cancel')
    @ApiOperation({ summary: 'Cancel an invoice' })
    @ApiResponse({ status: 200, description: 'Invoice cancelled' })
    @ApiResponse({ status: 400, description: 'Cannot cancel a paid invoice' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async cancelInvoice(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id') invoiceId: string,
    ) {
        return this.billingService.cancelInvoice(
            new Types.ObjectId(clinicId),
            new Types.ObjectId(invoiceId),
        );
    }

    @Post('invoices/:id/payments')
    @ApiOperation({ summary: 'Record a payment against an invoice' })
    @ApiResponse({ status: 201, description: 'Payment recorded, invoice updated' })
    @ApiResponse({ status: 400, description: 'Payment exceeds balance or invoice is cancelled/paid' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async addPayment(
        @CurrentUser() user: { userId: string; clinicId: string },
        @Param('id') invoiceId: string,
        @Body() dto: CreatePaymentDto,
    ) {
        return this.billingService.addPayment(
            new Types.ObjectId(user.clinicId),
            new Types.ObjectId(invoiceId),
            new Types.ObjectId(user.userId),
            dto,
        );
    }

    @Get('invoices/:id/payments')
    @ApiOperation({ summary: 'List all payments for an invoice' })
    @ApiResponse({ status: 200, description: 'List of payments' })
    @ApiResponse({ status: 404, description: 'Invoice not found' })
    async getPaymentsByInvoice(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id') invoiceId: string,
    ) {
        return this.billingService.getPaymentsByInvoice(
            new Types.ObjectId(clinicId),
            new Types.ObjectId(invoiceId),
        );
    }

    @Get('revenue')
    @ApiOperation({ summary: 'Get revenue statistics for a date range' })
    @ApiResponse({ status: 200, description: 'Revenue statistics' })
    async getRevenueStats(
        @CurrentUser('clinicId') clinicId: string,
        @Query() query: QueryRevenueDto,
    ) {
        return this.billingService.getRevenueStats(
            new Types.ObjectId(clinicId),
            query.startDate,
            query.endDate,
        );
    }

    @Get('patients/:patientId/history')
    @ApiOperation({ summary: 'Get billing history for a patient' })
    @ApiResponse({ status: 200, description: 'Patient billing history' })
    async getPatientBillingHistory(
        @CurrentUser('clinicId') clinicId: string,
        @Param('patientId') patientId: string,
    ) {
        return this.billingService.getPatientBillingHistory(
            new Types.ObjectId(clinicId),
            new Types.ObjectId(patientId),
        );
    }
}
