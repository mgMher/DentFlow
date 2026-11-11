import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppointmentStatus, CancelReason } from '../appointment.schema';
import { CreateAppointmentDto } from './create-appointment.dto';

/**
 * Reschedule or edit details. The patient is fixed: booking someone else
 * means a new appointment. Status has its own endpoint.
 */
export class UpdateAppointmentDto extends PartialType(OmitType(CreateAppointmentDto, ['patientId'] as const)) {}

export class UpdateAppointmentStatusDto {
    @ApiProperty({ enum: AppointmentStatus })
    @IsNotEmpty()
    @IsEnum(AppointmentStatus)
    status: AppointmentStatus;
}

/** Reasons a person may choose; the system-only ones are set automatically. */
export const USER_CANCEL_REASONS = [
    CancelReason.PATIENT_REQUEST,
    CancelReason.PATIENT_ILLNESS,
    CancelReason.CLINIC_RESCHEDULED,
    CancelReason.DENTIST_UNAVAILABLE,
    CancelReason.OTHER,
] as const;

export class CancelAppointmentDto {
    @ApiProperty({ enum: USER_CANCEL_REASONS })
    @IsIn(USER_CANCEL_REASONS as unknown as string[])
    reason: CancelReason;

    @ApiPropertyOptional({ example: 'Will call back next week' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;

    @ApiPropertyOptional({
        enum: ['this', 'following'],
        default: 'this',
        description: 'For a recurring series: this one only, or this and every later one',
    })
    @IsOptional()
    @IsIn(['this', 'following'])
    scope?: 'this' | 'following';
}
