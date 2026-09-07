import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Gender, PatientStatus } from '../patient.schema';

export const PATIENT_SORT_FIELDS = [
    'lastName',
    'firstName',
    'createdAt',
    'lastVisit',
    'dateOfBirth',
] as const;

export class QueryPatientDto {
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

    @ApiPropertyOptional({
        description: 'Search by name, patronymic, phone or email',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: Gender, description: 'Filter by gender' })
    @IsOptional()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional({ enum: PatientStatus, description: 'Filter by patient status' })
    @IsOptional()
    @IsEnum(PatientStatus)
    status?: PatientStatus;

    @ApiPropertyOptional({ description: 'Legacy filter by active status' })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false') return false;
        return undefined;
    })
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ enum: PATIENT_SORT_FIELDS, default: 'lastName' })
    @IsOptional()
    @IsIn(PATIENT_SORT_FIELDS as unknown as string[])
    sortBy?: string = 'lastName';

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'asc';
}
