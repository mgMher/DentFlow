import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { BILLING_EDITORS } from './billing.controller';
import { QueryFiscalReceiptsDto, SetFiscalNumberDto } from './dto/fiscal.dto';
import { FiscalService } from './fiscal.service';

const oid = (id: string) => new Types.ObjectId(id);

/** F10: fiscal receipt numbers from the clinic's own cash register, recorded against payments. */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class FiscalController {
    constructor(private readonly fiscal: FiscalService) {}

    @Get('fiscal-receipts')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Payments with / without a fiscal receipt number, newest first' })
    list(@CurrentUser('clinicId') clinicId: string, @Query() query: QueryFiscalReceiptsDto) {
        return this.fiscal.list(oid(clinicId), query);
    }

    @Patch('payments/:id/fiscal')
    @Roles(...BILLING_EDITORS)
    @ApiOperation({ summary: 'Record, change or clear (null) the fiscal receipt number; covers every part of the payment' })
    setFiscalNumber(
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') userId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: SetFiscalNumberDto,
    ) {
        return this.fiscal.setNumber(oid(clinicId), id, oid(userId), dto.fiscalNumber);
    }
}
