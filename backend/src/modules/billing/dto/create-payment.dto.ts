import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';
import { Trim } from 'src/common/decorators';
import { Currency } from 'src/common/utils';
import { PaymentMethod, PaymentVoidType } from '../payment.schema';

export class CreatePaymentDto {
    @ApiProperty({ example: 15000, description: 'Major units; at most the remaining balance' })
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiPropertyOptional({ enum: Currency, description: "Optional; must be the invoice's currency" })
    @IsOptional()
    @IsEnum(Currency)
    currency?: Currency;

    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
    @IsNotEmpty()
    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @ApiPropertyOptional({ example: '2026-03-10' })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({ example: 'TXN-123456', description: 'Card slip or transfer reference' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    reference?: string;

    @ApiPropertyOptional({ example: 'Cash payment received at reception' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class VoidPaymentDto {
    @ApiProperty({ enum: PaymentVoidType, description: '`refund`: money given back; `mistake`: entered in error' })
    @IsEnum(PaymentVoidType)
    type: PaymentVoidType;

    @ApiProperty({ example: 'Patient changed their mind' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}

export class CancelInvoiceDto {
    @ApiProperty({ example: 'Created for the wrong patient' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}
