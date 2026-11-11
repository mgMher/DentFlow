import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TreatmentEntryStatus } from '../treatment-entry.schema';

export class QueryRecordsDto {
    @ApiPropertyOptional({ example: '2025-01-01', description: 'Filter treatment entries from this date' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2025-12-31', description: 'Filter treatment entries until this date' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ example: 16, description: 'Only entries that include this FDI tooth' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    toothNumber?: number;

    @ApiPropertyOptional({ enum: TreatmentEntryStatus })
    @IsOptional()
    @IsEnum(TreatmentEntryStatus)
    status?: TreatmentEntryStatus;

    @ApiPropertyOptional({ default: false, description: 'Include voided entries' })
    @IsOptional()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    @IsBoolean()
    includeVoided?: boolean;

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
