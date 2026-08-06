import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TreatmentCategory } from '../treatment.schema';

export class QueryTreatmentDto {
    @ApiPropertyOptional({ enum: TreatmentCategory, description: 'Filter by treatment category' })
    @IsOptional()
    @IsEnum(TreatmentCategory)
    category?: TreatmentCategory;

    @ApiPropertyOptional({ example: 'filling', description: 'Search by name, code, or description' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: true, description: 'Filter by active status' })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 20, description: 'Items per page', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 20;
}
