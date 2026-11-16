import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Trim } from 'src/common/decorators';
import { SubscriptionStatus } from 'src/modules/clinics/clinic.schema';

export const CLINIC_STATES = ['active', 'trial', 'ending', 'ended', 'suspended'] as const;
export type ClinicState = (typeof CLINIC_STATES)[number];

export class QueryClinicsDto {
    @ApiPropertyOptional({ description: 'Name, email or phone' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ enum: CLINIC_STATES })
    @IsOptional()
    @IsIn(CLINIC_STATES)
    state?: ClinicState;
}

export class UpdateSubscriptionDto {
    @ApiPropertyOptional({ example: 'standard' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(50)
    plan?: string;

    @ApiPropertyOptional({ enum: SubscriptionStatus })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;

    @ApiPropertyOptional({ nullable: true, example: '2027-01-31', description: "Last day of access, in the clinic's calendar; null for no end" })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    endsOn?: string | null;
}

export class SuspendClinicDto {
    @ApiProperty({ example: 'Unpaid since October' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}

export class PlatformAuditQueryDto {
    @ApiPropertyOptional({ enum: ['platform', 'signins', 'all'], default: 'all' })
    @IsOptional()
    @IsIn(['platform', 'signins', 'all'])
    kind?: 'platform' | 'signins' | 'all';

    @ApiPropertyOptional() @IsOptional() @IsMongoId() clinicId?: string;

    @ApiPropertyOptional({ description: 'Entries before this id (paging)' }) @IsOptional() @IsMongoId() before?: string;

    @ApiPropertyOptional({ default: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number;
}

export class CreatePlatformAdminDto {
    @ApiProperty() @Trim() @IsEmail() @MaxLength(200) email: string;
    @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(100) firstName: string;
    @ApiProperty() @Trim() @IsString() @MinLength(1) @MaxLength(100) lastName: string;
}
