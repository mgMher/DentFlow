import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AppointmentStatus } from '../appointment.schema';

const toBool = ({ value }: { value: unknown }) => (value === true || value === 'true' ? true : value === false || value === 'false' ? false : value);

/**
 * Filters shared by the list and the calendar. The range is an overlap test:
 * an appointment that started before `startDate` but is still running counts.
 */
export class AppointmentFilterDto {
    @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z', description: 'Exclusive' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    patientId?: string;

    @ApiPropertyOptional({ enum: AppointmentStatus })
    @IsOptional()
    @IsEnum(AppointmentStatus)
    status?: AppointmentStatus;
}

export class QueryAppointmentDto extends AppointmentFilterDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ default: 20, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';
}

export class CalendarQueryDto extends AppointmentFilterDto {
    @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    startDate: string;

    @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ default: false, description: 'Include cancelled appointments' })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeCancelled?: boolean;
}
