import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { NotificationType } from '../notification.schema';

export class CreateNotificationDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'Recipient user ID' })
    @IsNotEmpty()
    @IsMongoId()
    recipientId: string;

    @ApiProperty({ enum: NotificationType, example: NotificationType.APPOINTMENT_REMINDER })
    @IsNotEmpty()
    @IsEnum(NotificationType)
    type: NotificationType;

    @ApiProperty({ example: 'Appointment Reminder' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ example: 'You have an appointment tomorrow at 10:00 AM' })
    @IsNotEmpty()
    @IsString()
    message: string;

    @ApiPropertyOptional({
        example: '507f1f77bcf86cd799439013',
        description: 'Related entity ID (appointment, patient, invoice)',
    })
    @IsOptional()
    @IsMongoId()
    relatedId?: string;

    @ApiPropertyOptional({
        example: 'Appointment',
        description: 'Related entity type',
    })
    @IsOptional()
    @IsString()
    relatedType?: string;
}
