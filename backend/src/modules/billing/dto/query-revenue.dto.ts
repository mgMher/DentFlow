import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryRevenueDto {
    @ApiPropertyOptional({ example: '2026-01-01', description: 'Revenue period start date' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-12-31', description: 'Revenue period end date' })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
