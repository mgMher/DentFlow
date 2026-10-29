import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    MaxLength,
    ArrayMaxSize,
    ArrayMinSize,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { InvoiceItemDto } from './create-invoice.dto';

/** Drafts only. The currency follows the clinic and is not editable. */
export class UpdateInvoiceDto {
    @ApiPropertyOptional({ type: [InvoiceItemDto], minItems: 1 })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => InvoiceItemDto)
    items?: InvoiceItemDto[];

    @ApiPropertyOptional({ example: 0, description: 'Tax amount' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number;

    @ApiPropertyOptional({ example: '2026-04-15', description: 'Empty string removes the due date' })
    @IsOptional()
    @ValidateIf((_, value) => value !== '')
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ example: 'Updated notes' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}
