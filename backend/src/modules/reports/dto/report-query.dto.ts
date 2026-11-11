import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { REPORT_GROUP_BY, ReportGroupBy } from '../report-periods';

const CALENDAR_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Date range for every report: clinic calendar days, both included. Missing
 * dates default to the clinic's current month up to today (they used to
 * become `Invalid Date` and return nothing).
 */
export class ReportQueryDto {
    @ApiPropertyOptional({ example: '2026-10-01', description: 'First clinic day (default: 1st of this month)' })
    @IsOptional()
    @Matches(CALENDAR_DAY, { message: 'startDate must be YYYY-MM-DD' })
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-10-31', description: 'Last clinic day, included (default: today)' })
    @IsOptional()
    @Matches(CALENDAR_DAY, { message: 'endDate must be YYYY-MM-DD' })
    endDate?: string;

    @ApiPropertyOptional({ enum: REPORT_GROUP_BY, default: 'day', description: 'Chart periods (revenue only)' })
    @IsOptional()
    @IsIn(REPORT_GROUP_BY)
    groupBy?: ReportGroupBy;
}
