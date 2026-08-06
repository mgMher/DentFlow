import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { PaymentMethod, PaymentCurrency } from '../payment.schema';

export class CreatePaymentDto {
    @ApiProperty({ example: 15000, minimum: 0, description: 'Payment amount' })
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    amount: number;

    @ApiPropertyOptional({ enum: PaymentCurrency, default: PaymentCurrency.AMD })
    @IsOptional()
    @IsEnum(PaymentCurrency)
    currency?: PaymentCurrency;

    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
    @IsNotEmpty()
    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @ApiPropertyOptional({ example: '2026-03-10' })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({ example: 'TXN-123456', description: 'Transaction reference number' })
    @IsOptional()
    @IsString()
    reference?: string;

    @ApiPropertyOptional({ example: 'Cash payment received at reception' })
    @IsOptional()
    @IsString()
    notes?: string;
}
