import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Matches, Max, Min } from 'class-validator';

export const AUDIT_AREA_NAMES = [
    'patients',
    'chart',
    'plans',
    'appointments',
    'billing',
    'documents',
    'staff',
    'clinic',
    'catalog',
    'schedule',
    'settings',
    'reminders',
    'auth',
] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Shared paging: newest first, `before` is the last id of the previous page. */
export class AuditPageDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    before?: string;

    @ApiPropertyOptional({ default: 50, maximum: 200 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number;
}

export class QueryAuditDto extends AuditPageDto {
    @ApiPropertyOptional({ example: '2026-11-01', description: 'Clinic day, inclusive' })
    @IsOptional()
    @Matches(DAY)
    from?: string;

    @ApiPropertyOptional({ example: '2026-11-12', description: 'Clinic day, inclusive' })
    @IsOptional()
    @Matches(DAY)
    to?: string;

    @ApiPropertyOptional({ description: 'Who did it (login account id)' })
    @IsOptional()
    @IsMongoId()
    userId?: string;

    @ApiPropertyOptional({ enum: AUDIT_AREA_NAMES })
    @IsOptional()
    @IsIn(AUDIT_AREA_NAMES as unknown as string[])
    area?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    patientId?: string;
}
