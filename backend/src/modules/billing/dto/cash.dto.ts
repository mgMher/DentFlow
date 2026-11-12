import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const toBool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);

export class CashReportQueryDto {
    @ApiPropertyOptional({ example: '2026-11-12', description: 'Clinic day; defaults to today' })
    @IsOptional()
    @Matches(DAY)
    date?: string;
}

export class CloseDayDto {
    @ApiProperty({ example: '2026-11-12' }) @Matches(DAY) date: string;

    @ApiProperty({ example: 185000, description: 'Cash counted in the drawer, major units' })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    countedCash: number;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class DebtorsQueryDto {
    @ApiPropertyOptional({ description: 'Only patients with an invoice past its due date' })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    overdueOnly?: boolean;

    @ApiPropertyOptional({ description: 'Smallest amount owed to list, major units' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAmount?: number;

    @ApiPropertyOptional({ enum: ['amount', 'age'], default: 'amount' })
    @IsOptional()
    @IsIn(['amount', 'age'])
    sort?: 'amount' | 'age';
}
