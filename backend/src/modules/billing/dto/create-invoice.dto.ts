import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    Max,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { InvoiceCurrency } from '../invoice.schema';

export class InvoiceItemDto {
    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012' })
    @IsOptional()
    @IsMongoId()
    treatmentId?: string;

    @ApiProperty({ example: 'Teeth cleaning' })
    @IsNotEmpty()
    @IsString()
    description: string;

    @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    quantity?: number = 1;

    @ApiProperty({ example: 15000, minimum: 0 })
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiPropertyOptional({ example: 10, default: 0, description: 'Discount percentage (0-100)' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100)
    discount?: number = 0;
}

export class CreateInvoiceDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @IsNotEmpty()
    @IsMongoId()
    patientId: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439013' })
    @IsOptional()
    @IsMongoId()
    appointmentId?: string;

    @ApiProperty({ type: [InvoiceItemDto], minItems: 1 })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => InvoiceItemDto)
    items: InvoiceItemDto[];

    @ApiPropertyOptional({ example: 0, default: 0, description: 'Tax amount' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number = 0;

    @ApiPropertyOptional({ enum: InvoiceCurrency, default: InvoiceCurrency.AMD })
    @IsOptional()
    @IsEnum(InvoiceCurrency)
    currency?: InvoiceCurrency = InvoiceCurrency.AMD;

    @ApiPropertyOptional({ example: '2026-04-15' })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ example: 'Initial consultation and cleaning' })
    @IsOptional()
    @IsString()
    notes?: string;
}
