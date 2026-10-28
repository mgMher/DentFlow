import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringFrequency } from '../appointment.schema';

/** A series never generates more than this many appointments (about a year of weekly visits). */
export const MAX_SERIES_OCCURRENCES = 52;

export class RecurringPatternDto {
    @ApiProperty({ enum: RecurringFrequency, example: RecurringFrequency.WEEKLY })
    @IsNotEmpty()
    @IsEnum(RecurringFrequency)
    frequency: RecurringFrequency;

    @ApiProperty({ example: 1, description: 'Repeat every N frequency units' })
    @IsInt()
    @Min(1)
    @Max(12)
    interval: number;

    @ApiProperty({ example: '2026-12-31', description: 'Last day of the series (clinic calendar day), inclusive' })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: [1, 3, 5], description: 'Weekly only: days of week (0=Sun, 6=Sat)' })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(6, { each: true })
    daysOfWeek?: number[];
}

/**
 * A new appointment. Status is not settable: every appointment starts
 * scheduled and moves through PATCH /:id/status. Recurring series go through
 * POST /recurring.
 */
export class CreateAppointmentDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @IsNotEmpty()
    @IsMongoId()
    patientId: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439012', description: "The dentist's user (auth) id" })
    @IsNotEmpty()
    @IsMongoId()
    dentistId: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439013' })
    @IsOptional()
    @IsMongoId()
    treatmentRoomId?: string;

    @ApiPropertyOptional({ example: 'Root canal, upper molar', description: 'Optional; the UI shows the treatments when empty' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiProperty({ example: '2026-06-15T05:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    startTime: string;

    @ApiProperty({ example: '2026-06-15T06:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    endTime: string;

    @ApiPropertyOptional({ example: ['507f1f77bcf86cd799439014'], description: 'Catalogue treatments planned for the visit' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsMongoId({ each: true })
    treatmentIds?: string[];

    @ApiPropertyOptional({ example: 'Endodontics', description: 'Free-text visit type, kept for older records' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    treatmentType?: string;

    @ApiPropertyOptional({ example: 'Patient prefers morning appointments' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;

    @ApiPropertyOptional({ example: '#4CAF50', description: 'Hex color for calendar display' })
    @IsOptional()
    @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'color must be a valid hex color (e.g. #FF5733)' })
    color?: string;

    @ApiPropertyOptional({
        default: false,
        description: "Book even though it is outside the dentist's working hours (blocked time is never overridden)",
    })
    @IsOptional()
    @IsBoolean()
    allowOutsideHours?: boolean;
}

export class CreateRecurringAppointmentDto extends CreateAppointmentDto {
    @ApiProperty({ type: RecurringPatternDto })
    @ValidateNested()
    @Type(() => RecurringPatternDto)
    recurringPattern: RecurringPatternDto;
}
