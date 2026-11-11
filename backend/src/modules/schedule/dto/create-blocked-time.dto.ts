import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsDateString,
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { BlockedTimeReason } from '../blocked-time.schema';

export class CreateBlockedTimeDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'Dentist user ID' })
    @IsNotEmpty()
    @IsMongoId()
    dentistId: string;

    @ApiProperty({ example: '2025-06-15T12:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    startTime: string;

    @ApiProperty({ example: '2025-06-15T13:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    endTime: string;

    @ApiProperty({ enum: BlockedTimeReason, example: BlockedTimeReason.LUNCH })
    @IsNotEmpty()
    @IsEnum(BlockedTimeReason)
    reason: BlockedTimeReason;

    @ApiPropertyOptional({ example: 'Lunch break' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    // `isRecurring` was accepted but never expanded into repeats; it is gone
    // until recurring blocks (e.g. a weekly lunch) are actually built.
}
