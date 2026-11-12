import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Matches, Max, Min } from 'class-validator';

export const SLOT_STEPS = [5, 10, 15, 20, 30, 60];

export class QuerySlotsDto {
    @ApiProperty({ description: 'Dentist (auth user id)' })
    @IsMongoId()
    dentistId: string;

    @ApiProperty({ example: '2026-11-20', description: 'Clinic calendar day' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date: string;

    @ApiProperty({ example: 30, description: 'Visit length in minutes' })
    @Type(() => Number)
    @IsInt()
    @Min(5)
    @Max(720)
    duration: number;

    @ApiPropertyOptional({ description: 'Chair that must be free too' })
    @IsOptional()
    @IsMongoId()
    treatmentRoomId?: string;

    @ApiPropertyOptional({ description: 'Patient who must be free too' })
    @IsOptional()
    @IsMongoId()
    patientId?: string;

    @ApiPropertyOptional({ description: 'Appointment being moved (its own time does not count as taken)' })
    @IsOptional()
    @IsMongoId()
    excludeAppointmentId?: string;

    @ApiPropertyOptional({ default: 15, enum: SLOT_STEPS })
    @IsOptional()
    @Type(() => Number)
    @IsIn(SLOT_STEPS)
    step?: number;
}
