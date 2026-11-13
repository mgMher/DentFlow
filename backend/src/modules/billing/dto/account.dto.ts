import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../payment.schema';

export class AllocationDto {
    @ApiProperty() @IsMongoId() invoiceId: string;

    @ApiProperty({ example: 10000, description: 'Major units' })
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    amount: number;
}

/**
 * Money from a patient, spread over their open invoices. Without
 * `allocations` it pays the oldest invoices first; `[]` puts it all on
 * account. Whatever is not allocated becomes the patient's credit.
 */
export class TakePaymentDto {
    @ApiProperty({ example: 50000, description: 'Major units, in the clinic currency' })
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;

    @ApiPropertyOptional({ example: '2026-11-12' }) @IsOptional() @IsDateString() date?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) reference?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;

    @ApiPropertyOptional({
        description: "F8: also pay the open invoices of the patients this one is the guardian of; each invoice is paid on the child's account, the rest is the payer's credit",
    })
    @IsOptional()
    @IsBoolean()
    family?: boolean;

    @ApiPropertyOptional({ type: [AllocationDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => AllocationDto)
    allocations?: AllocationDto[];
}

export class ApplyCreditDto {
    @ApiPropertyOptional({ description: 'Major units; defaults to as much as the credit and the balance allow' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    amount?: number;
}
