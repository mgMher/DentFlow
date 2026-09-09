import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import {
    ARMENIAN_PHONE_E164,
    ARMENIAN_PHONE_MESSAGE,
    normalizeArmenianPhone,
} from 'src/common/utils';
import { Gender } from '../patient.schema';

/**
 * Turns `''` / `'   '` into `undefined` ("not provided"). `null` is left alone:
 * on update it is the explicit "clear this field" signal.
 */
const blankToUndefined = (value: unknown) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value;

const emptyToUndefined = ({ value }: { value: unknown }) => blankToUndefined(value);

const toEmail = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? blankToUndefined(value.trim().toLowerCase()) : value;

const toArmenianPhone = ({ value }: { value: unknown }) => {
    const cleaned = blankToUndefined(value);
    return typeof cleaned === 'string' ? normalizeArmenianPhone(cleaned) : cleaned;
};

export class AddressDto {
    @ApiPropertyOptional({ example: '12 Tumanyan St' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    street?: string;

    @ApiPropertyOptional({ example: 'Yerevan' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    city?: string;

    @ApiPropertyOptional({ example: 'Yerevan' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    state?: string;

    @ApiPropertyOptional({ example: '0001' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    zipCode?: string;

    @ApiPropertyOptional({ example: 'Armenia' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    country?: string;
}

export class EmergencyContactDto {
    @ApiPropertyOptional({ example: 'Anahit Sargsyan' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @ApiPropertyOptional({ example: 'spouse' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    relationship?: string;

    @ApiPropertyOptional({ example: '+37491654321' })
    @IsOptional()
    @Transform(toArmenianPhone)
    @IsString()
    @Matches(ARMENIAN_PHONE_E164, { message: `emergencyContact.phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone?: string;
}

export class MedicalHistoryDto {
    @ApiPropertyOptional({ example: ['Diabetes', 'Hypertension'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(120, { each: true })
    conditions?: string[];

    @ApiPropertyOptional({ example: ['Penicillin'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(120, { each: true })
    allergies?: string[];

    @ApiPropertyOptional({ example: ['Metformin 500mg'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(120, { each: true })
    medications?: string[];

    @ApiPropertyOptional({ example: 'Patient has a history of dental anxiety' })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;
}

export class InsuranceDto {
    @ApiPropertyOptional({ example: 'Ingo Armenia' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    provider?: string;

    @ApiPropertyOptional({ example: 'POL-123456' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    policyNumber?: string;

    @ApiPropertyOptional({ example: 'GRP-7890' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    groupNumber?: string;

    @ApiPropertyOptional({ example: '2026-12-31' })
    @IsOptional()
    @Transform(emptyToUndefined)
    @IsDateString()
    expirationDate?: string;
}

export class CreatePatientDto {
    @ApiProperty({ example: 'Armen' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    firstName: string;

    @ApiProperty({ example: 'Hakobyan' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    lastName: string;

    @ApiPropertyOptional({
        example: 'Gevorgovich',
        description: 'Send `null` on update to clear it.',
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    patronymic?: string | null;

    @ApiProperty({ example: '1990-05-15' })
    @IsNotEmpty()
    @IsDateString()
    dateOfBirth: string;

    @ApiProperty({ enum: Gender, example: Gender.MALE })
    @IsNotEmpty()
    @IsEnum(Gender)
    gender: Gender;

    @ApiProperty({
        example: '+37493123456',
        description: 'Armenian phone number. Normalized to +374XXXXXXXX on save.',
    })
    @Transform(toArmenianPhone)
    @IsNotEmpty()
    @IsString()
    @Matches(ARMENIAN_PHONE_E164, { message: `phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone: string;

    @ApiPropertyOptional({
        example: 'armen.hakobyan@example.com',
        description: 'Unique per clinic. Send `null` on update to clear it.',
        nullable: true,
    })
    @IsOptional()
    @Transform(toEmail)
    @IsEmail()
    @MaxLength(200)
    email?: string | null;

    @ApiPropertyOptional({
        description:
            'Patient photo as a data URL (image/jpeg, image/png or image/webp). Send `null` on update to remove it.',
        example: 'data:image/jpeg;base64,/9j/4AAQ...',
        nullable: true,
    })
    @IsOptional()
    @Transform(emptyToUndefined)
    @IsString()
    @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/, {
        message: 'photo must be a base64 data URL of type image/jpeg, image/png or image/webp',
    })
    @MaxLength(2_000_000, { message: 'photo must be smaller than ~1.5MB' })
    photo?: string | null;

    @ApiPropertyOptional({ type: AddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;

    @ApiPropertyOptional({
        type: EmergencyContactDto,
        description: 'Send `null` on update to remove the contact.',
        nullable: true,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => EmergencyContactDto)
    emergencyContact?: EmergencyContactDto | null;

    @ApiPropertyOptional({ type: MedicalHistoryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => MedicalHistoryDto)
    medicalHistory?: MedicalHistoryDto;

    @ApiPropertyOptional({
        type: InsuranceDto,
        description: 'Send `null` on update to remove the insurance block.',
        nullable: true,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => InsuranceDto)
    insurance?: InsuranceDto | null;

    @ApiPropertyOptional({ example: 'Referred by Dr. Petrosyan' })
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    notes?: string;
}
