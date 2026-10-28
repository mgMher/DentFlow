import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator';
import { IsOptionalNotNull } from 'src/common/decorators';
import { ARMENIAN_PHONE_E164, ARMENIAN_PHONE_MESSAGE } from 'src/common/utils';
import { Gender, PatientStatus } from '../patient.schema';
import { CreatePatientDto, toArmenianPhone } from './create-patient.dto';

/** Fields every patient must have: they may be omitted on update, but never cleared. */
const REQUIRED_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'phone'] as const;

/**
 * Partial update. For optional fields `null` means "clear it"; the required
 * ones are redeclared with `IsOptionalNotNull`, because `PartialType` lets
 * `null` through and `{ firstName: null }` used to reach the database and 500.
 *
 * Status is not here: it changes only through PATCH /patients/:id/status,
 * which is role-restricted and audited.
 */
export class UpdatePatientDto extends PartialType(OmitType(CreatePatientDto, REQUIRED_FIELDS)) {
    @ApiPropertyOptional({ example: 'Armen' })
    @IsOptionalNotNull()
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    firstName?: string;

    @ApiPropertyOptional({ example: 'Hakobyan' })
    @IsOptionalNotNull()
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    lastName?: string;

    @ApiPropertyOptional({ example: '1990-05-15' })
    @IsOptionalNotNull()
    @IsDateString()
    dateOfBirth?: string;

    @ApiPropertyOptional({ enum: Gender })
    @IsOptionalNotNull()
    @IsEnum(Gender)
    gender?: Gender;

    @ApiPropertyOptional({ example: '+37493123456' })
    @Transform(toArmenianPhone)
    @IsOptionalNotNull()
    @IsString()
    @Matches(ARMENIAN_PHONE_E164, { message: `phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone?: string;
}

export class UpdatePatientStatusDto {
    @ApiProperty({ enum: PatientStatus, example: PatientStatus.INACTIVE })
    @IsNotEmpty()
    @IsEnum(PatientStatus)
    status: PatientStatus;

    @ApiPropertyOptional({ example: 'Moved to another city' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;

    @ApiPropertyOptional({ description: "Also cancel the patient's upcoming appointments" })
    @IsOptional()
    @IsBoolean()
    cancelUpcomingAppointments?: boolean;
}

/** Exact-match lookup for "is this person already registered?" */
export class DuplicatePatientQueryDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
    @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
    @ApiPropertyOptional() @IsOptional() @Transform(toArmenianPhone) @IsString() phone?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) email?: string;
    @ApiPropertyOptional({ description: 'Patient being edited, left out of the results' })
    @IsOptional()
    @IsString()
    excludeId?: string;
}
