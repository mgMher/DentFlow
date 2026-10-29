import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsIn,
    IsInt,
    IsMongoId,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import { InvoiceStatus } from '../invoice.schema';

/** Stored statuses plus `overdue` (issued or partly paid, past the due date). */
export const INVOICE_STATUS_FILTERS = [...Object.values(InvoiceStatus), 'overdue'] as const;
export type InvoiceStatusFilter = (typeof INVOICE_STATUS_FILTERS)[number];

export class QueryInvoiceDto {
    @ApiPropertyOptional({ enum: INVOICE_STATUS_FILTERS, description: 'Filter by invoice status' })
    @IsOptional()
    @IsIn(INVOICE_STATUS_FILTERS)
    status?: InvoiceStatusFilter;

    @ApiPropertyOptional({ example: 'Hakobyan', description: 'Invoice number, patient name or phone' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Filter by patient' })
    @IsOptional()
    @IsMongoId()
    patientId?: string;

    @ApiPropertyOptional({ example: '2026-01-01', description: 'Created on or after this clinic day' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-12-31', description: 'Created on or before this clinic day' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}
