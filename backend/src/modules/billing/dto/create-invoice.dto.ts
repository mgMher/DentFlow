import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    Max,
    MaxLength,
    ValidateNested,
    ArrayMaxSize,
    ArrayMinSize,
} from 'class-validator';
import { Trim } from 'src/common/decorators';
import { Currency } from 'src/common/utils';

/** Amounts are in major units (dram, dollars); the server stores them as integers. */
export class InvoiceItemDto {
    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012', description: 'Catalogue treatment' })
    @IsOptional()
    @IsMongoId()
    treatmentId?: string;

    @ApiPropertyOptional({
        example: '507f1f77bcf86cd799439014',
        description: 'Done chart entry this line bills; one entry can be on only one live invoice',
    })
    @IsOptional()
    @IsMongoId()
    treatmentEntryId?: string;

    @ApiProperty({ example: 'Teeth cleaning' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(300)
    description: string;

    @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(1000)
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
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => InvoiceItemDto)
    items: InvoiceItemDto[];

    @ApiPropertyOptional({ example: 0, default: 0, description: 'Tax amount' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number = 0;

    @ApiPropertyOptional({
        enum: Currency,
        description: "Optional; must be the clinic's currency (D3). Defaults to it.",
    })
    @IsOptional()
    @IsEnum(Currency)
    currency?: Currency;

    @ApiPropertyOptional({ example: '2026-04-15' })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ example: 'Initial consultation and cleaning' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;

    @ApiPropertyOptional({ default: false, description: 'Issue right away (payments need an issued invoice)' })
    @IsOptional()
    @IsBoolean()
    issue?: boolean;
}
