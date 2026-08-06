import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEmail,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    Min,
    ValidateNested,
    IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SupportedCurrency, SupportedLanguage, SubscriptionStatus } from '../clinic.schema';

export class UpdateAddressDto {
    @ApiPropertyOptional({ example: '15 Tumanyan St' })
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

export class UpdateWorkingHourDto {
    @ApiPropertyOptional({ example: 1, description: '0 = Sunday, 6 = Saturday' })
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiPropertyOptional({ example: '09:00' })
    @IsString()
    startTime: string;

    @ApiPropertyOptional({ example: '18:00' })
    @IsString()
    endTime: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isOpen?: boolean;
}

export class UpdateSubscriptionDto {
    @ApiPropertyOptional({ example: 'premium' })
    @IsOptional()
    @IsString()
    plan?: string;

    @ApiPropertyOptional({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;

    @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class UpdateClinicDto {
    @ApiPropertyOptional({ example: 'Bright Smile Dental' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ type: UpdateAddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateAddressDto)
    address?: UpdateAddressDto;

    @ApiPropertyOptional({ example: '+374 10 123456' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'info@brightsmile.am' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
    @IsOptional()
    @IsString()
    logo?: string;

    @ApiPropertyOptional({ type: [UpdateWorkingHourDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateWorkingHourDto)
    workingHours?: UpdateWorkingHourDto[];

    @ApiPropertyOptional({ example: 'Asia/Yerevan' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({ enum: SupportedLanguage, example: SupportedLanguage.HY })
    @IsOptional()
    @IsEnum(SupportedLanguage)
    language?: SupportedLanguage;

    @ApiPropertyOptional({ enum: SupportedCurrency, example: SupportedCurrency.AMD })
    @IsOptional()
    @IsEnum(SupportedCurrency)
    currency?: SupportedCurrency;

    @ApiPropertyOptional({ type: UpdateSubscriptionDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateSubscriptionDto)
    subscription?: UpdateSubscriptionDto;
}

export class UpdateWorkingHoursDto {
    @ApiPropertyOptional({ type: [UpdateWorkingHourDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateWorkingHourDto)
    workingHours: UpdateWorkingHourDto[];
}

export class UpdateSettingsDto {
    @ApiPropertyOptional({ enum: SupportedLanguage, example: SupportedLanguage.HY })
    @IsOptional()
    @IsEnum(SupportedLanguage)
    language?: SupportedLanguage;

    @ApiPropertyOptional({ enum: SupportedCurrency, example: SupportedCurrency.AMD })
    @IsOptional()
    @IsEnum(SupportedCurrency)
    currency?: SupportedCurrency;

    @ApiPropertyOptional({ example: 'Asia/Yerevan' })
    @IsOptional()
    @IsString()
    timezone?: string;
}
