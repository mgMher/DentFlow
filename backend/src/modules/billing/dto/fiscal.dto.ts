import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/** Fiscal receipt numbers: digits, letters, dashes, slashes; spaces trimmed and collapsed. */
export const FISCAL_NUMBER = /^[0-9A-Za-z][0-9A-Za-z\-\/ ]{0,39}$/;
export const cleanFiscalNumber = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || null : value;

/** F10: record (or clear, with `null`) the fiscal receipt number of a payment. */
export class SetFiscalNumberDto {
    @ApiPropertyOptional({ example: '23456789', nullable: true, description: 'From the receipt your cash register printed; null clears it' })
    @Transform(cleanFiscalNumber)
    @ValidateIf((_, v) => v !== null)
    @IsString()
    @MaxLength(40)
    @Matches(FISCAL_NUMBER, { message: 'fiscalNumber: digits and letters only' })
    fiscalNumber: string | null;
}

export class QueryFiscalReceiptsDto {
    @ApiPropertyOptional({ enum: ['missing', 'recorded', 'all'], default: 'missing' })
    @IsOptional()
    @IsIn(['missing', 'recorded', 'all'])
    status?: 'missing' | 'recorded' | 'all';

    @ApiPropertyOptional({ example: '2026-11-01', description: 'Clinic day, inclusive' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    from?: string;

    @ApiPropertyOptional({ example: '2026-11-15', description: 'Clinic day, inclusive' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    to?: string;

    @ApiPropertyOptional({ default: 100, maximum: 500 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit?: number;
}

/** F10: optional on any new payment, when the receipt was printed while recording it. */
export const OptionalFiscalNumber = () =>
    applyDecorators(
        ApiPropertyOptional({ example: '23456789', description: 'F10: fiscal receipt number from your cash register' }),
        IsOptional(),
        Transform(cleanFiscalNumber),
        ValidateIf((_, v) => v !== null),
        IsString(),
        MaxLength(40),
        Matches(FISCAL_NUMBER, { message: 'fiscalNumber: digits and letters only' }),
    );
