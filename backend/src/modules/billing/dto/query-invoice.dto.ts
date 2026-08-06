import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsOptional,
    Max,
    Min,
} from 'class-validator';
import { InvoiceStatus } from '../invoice.schema';

export class QueryInvoiceDto {
    @ApiPropertyOptional({ enum: InvoiceStatus, description: 'Filter by invoice status' })
    @IsOptional()
    @IsEnum(InvoiceStatus)
    status?: InvoiceStatus;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Filter by patient' })
    @IsOptional()
    @IsMongoId()
    patientId?: string;

    @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date for date range filter' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-12-31', description: 'End date for date range filter' })
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
