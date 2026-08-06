import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus, RecurringFrequency } from '../appointment.schema';

export class RecurringPatternDto {
    @ApiProperty({ enum: RecurringFrequency, example: RecurringFrequency.WEEKLY })
    @IsNotEmpty()
    @IsEnum(RecurringFrequency)
    frequency: RecurringFrequency;

    @ApiProperty({ example: 1, description: 'Repeat every N frequency units' })
    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    interval: number;

    @ApiProperty({ example: '2025-12-31T00:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: [1, 3, 5], description: 'Days of week (0=Sun, 6=Sat)' })
    @IsOptional()
    @IsArray()
    @IsNumber({}, { each: true })
    daysOfWeek?: number[];
}

export class CreateAppointmentDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439011' })
    @IsNotEmpty()
    @IsMongoId()
    patientId: string;

    @ApiProperty({ example: '507f1f77bcf86cd799439012' })
    @IsNotEmpty()
    @IsMongoId()
    dentistId: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439013' })
    @IsOptional()
    @IsMongoId()
    treatmentRoomId?: string;

    @ApiProperty({ example: 'Root Canal - Upper Molar' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ example: '2025-06-15T09:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    startTime: string;

    @ApiProperty({ example: '2025-06-15T10:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    endTime: string;

    @ApiPropertyOptional({ example: 60, description: 'Duration in minutes' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number;

    @ApiPropertyOptional({ enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
    @IsOptional()
    @IsEnum(AppointmentStatus)
    status?: AppointmentStatus;

    @ApiPropertyOptional({ example: 'Endodontics' })
    @IsOptional()
    @IsString()
    treatmentType?: string;

    @ApiPropertyOptional({ example: ['507f1f77bcf86cd799439014'] })
    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    treatmentIds?: string[];

    @ApiPropertyOptional({ example: 'Patient prefers morning appointments' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;

    @ApiPropertyOptional({ type: RecurringPatternDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => RecurringPatternDto)
    recurringPattern?: RecurringPatternDto;

    @ApiPropertyOptional({ example: '#4CAF50', description: 'Hex color for calendar display' })
    @IsOptional()
    @IsString()
    @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
        message: 'color must be a valid hex color (e.g. #FF5733)',
    })
    color?: string;
}
