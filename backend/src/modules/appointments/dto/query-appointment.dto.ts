import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '../appointment.schema';

export class QueryAppointmentDto {
    @ApiPropertyOptional({ example: '2025-06-01T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2025-06-30T23:59:59.000Z' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012' })
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
    @IsOptional()
    @IsMongoId()
    patientId?: string;

    @ApiPropertyOptional({ enum: AppointmentStatus })
    @IsOptional()
    @IsEnum(AppointmentStatus)
    status?: AppointmentStatus;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 20, default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number;
}
