import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Gender } from '../patient.schema';

export class AddressDto {
    @ApiPropertyOptional({ example: '12 Tumanyan St' })
    @IsOptional()
    @IsString()
    street?: string;

    @ApiPropertyOptional({ example: 'Yerevan' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({ example: 'Yerevan' })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiPropertyOptional({ example: '0001' })
    @IsOptional()
    @IsString()
    zipCode?: string;

    @ApiPropertyOptional({ example: 'Armenia' })
    @IsOptional()
    @IsString()
    country?: string;
}

export class EmergencyContactDto {
    @ApiPropertyOptional({ example: 'Anahit Sargsyan' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'Spouse' })
    @IsOptional()
    @IsString()
    relationship?: string;

    @ApiPropertyOptional({ example: '+374 91 654321' })
    @IsOptional()
    @IsString()
    phone?: string;
}

export class MedicalHistoryDto {
    @ApiPropertyOptional({ example: ['Diabetes', 'Hypertension'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    conditions?: string[];

    @ApiPropertyOptional({ example: ['Penicillin'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allergies?: string[];

    @ApiPropertyOptional({ example: ['Metformin 500mg'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    medications?: string[];

    @ApiPropertyOptional({ example: 'Patient has a history of dental anxiety' })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class InsuranceDto {
    @ApiPropertyOptional({ example: 'Ingo Armenia' })
    @IsOptional()
    @IsString()
    provider?: string;

    @ApiPropertyOptional({ example: 'POL-123456' })
    @IsOptional()
    @IsString()
    policyNumber?: string;

    @ApiPropertyOptional({ example: 'GRP-7890' })
    @IsOptional()
    @IsString()
    groupNumber?: string;

    @ApiPropertyOptional({ example: '2026-12-31' })
    @IsOptional()
    @IsDateString()
    expirationDate?: string;
}

export class CreatePatientDto {
    @ApiProperty({ example: 'Armen' })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Hakobyan' })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiPropertyOptional({ example: 'Gevorgovich' })
    @IsOptional()
    @IsString()
    patronymic?: string;

    @ApiProperty({ example: '1990-05-15' })
    @IsNotEmpty()
    @IsDateString()
    dateOfBirth: string;

    @ApiProperty({ enum: Gender, example: Gender.MALE })
    @IsNotEmpty()
    @IsEnum(Gender)
    gender: Gender;

    @ApiProperty({ example: '+374 93 123456' })
    @IsNotEmpty()
    @IsString()
    phone: string;

    @ApiPropertyOptional({ example: 'armen.hakobyan@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ type: AddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => AddressDto)
    address?: AddressDto;

    @ApiPropertyOptional({ type: EmergencyContactDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => EmergencyContactDto)
    emergencyContact?: EmergencyContactDto;

    @ApiPropertyOptional({ type: MedicalHistoryDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => MedicalHistoryDto)
    medicalHistory?: MedicalHistoryDto;

    @ApiPropertyOptional({ type: InsuranceDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => InsuranceDto)
    insurance?: InsuranceDto;

    @ApiPropertyOptional({ example: 'Referred by Dr. Petrosyan' })
    @IsOptional()
    @IsString()
    notes?: string;
}
