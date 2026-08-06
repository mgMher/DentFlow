import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ArrayMinSize,
    ValidateNested,
} from 'class-validator';
import { InvoiceCurrency } from '../invoice.schema';
import { InvoiceItemDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
    @ApiPropertyOptional({ type: [InvoiceItemDto], minItems: 1 })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => InvoiceItemDto)
    items?: InvoiceItemDto[];

    @ApiPropertyOptional({ example: 0, description: 'Tax amount' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number;

    @ApiPropertyOptional({ enum: InvoiceCurrency })
    @IsOptional()
    @IsEnum(InvoiceCurrency)
    currency?: InvoiceCurrency;

    @ApiPropertyOptional({ example: '2026-04-15' })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ example: 'Updated notes' })
    @IsOptional()
    @IsString()
    notes?: string;
}
