import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEmail,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsTimeZone, TIME_OF_DAY, Trim } from 'src/common/decorators';
import { ARMENIAN_PHONE_E164, ARMENIAN_PHONE_MESSAGE, normalizeArmenianPhone } from 'src/common/utils';
import { SupportedLanguage } from '../clinic.schema';
import { Currency } from 'src/common/utils';

/** `''` means "clear this field", so it skips the format check. */
const unlessEmpty = ValidateIf((_, value) => value !== '');

export class UpdateAddressDto {
    @ApiPropertyOptional({ example: '15 Tumanyan St' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(200)
    street?: string;

    @ApiPropertyOptional({ example: 'Yerevan' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(100)
    city?: string;

    @ApiPropertyOptional({ example: 'Yerevan' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(100)
    state?: string;

    @ApiPropertyOptional({ example: '0001' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(100)
    zipCode?: string;

    @ApiPropertyOptional({ example: 'Armenia' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(100)
    country?: string;
}

export class UpdateWorkingHourDto {
    @ApiPropertyOptional({ example: 1, description: '0 = Sunday, 6 = Saturday' })
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiPropertyOptional({ example: '09:00' })
    @Matches(TIME_OF_DAY, { message: 'startTime must be in HH:MM format' })
    startTime: string;

    @ApiPropertyOptional({ example: '18:00' })
    @Matches(TIME_OF_DAY, { message: 'endTime must be in HH:MM format' })
    endTime: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isOpen?: boolean;
}

export class UpdateClinicDto {
    @ApiPropertyOptional({ example: 'Bright Smile Dental' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiPropertyOptional({ type: UpdateAddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateAddressDto)
    address?: UpdateAddressDto;

    @ApiPropertyOptional({ example: '+374 10 123456' })
    @IsOptional()
    @Transform(({ value }) => normalizeArmenianPhone(value))
    @unlessEmpty
    @Matches(ARMENIAN_PHONE_E164, { message: `phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone?: string;

    @ApiPropertyOptional({ example: 'info@brightsmile.am' })
    @IsOptional()
    @Trim()
    @unlessEmpty
    @IsEmail()
    @MaxLength(254)
    email?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(500)
    logo?: string;

    @ApiPropertyOptional({ type: [UpdateWorkingHourDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateWorkingHourDto)
    workingHours?: UpdateWorkingHourDto[];

    @ApiPropertyOptional({ example: 'Asia/Yerevan' })
    @IsOptional()
    @IsTimeZone()
    timezone?: string;

    @ApiPropertyOptional({ enum: SupportedLanguage, example: SupportedLanguage.HY })
    @IsOptional()
    @IsEnum(SupportedLanguage)
    language?: SupportedLanguage;

    @ApiPropertyOptional({ enum: Currency, example: Currency.AMD })
    @IsOptional()
    @IsEnum(Currency)
    currency?: Currency;

    // `subscription` is deliberately absent: a clinic must not be able to
    // grant itself a plan. It belongs to a platform-admin path.
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

    @ApiPropertyOptional({ enum: Currency, example: Currency.AMD })
    @IsOptional()
    @IsEnum(Currency)
    currency?: Currency;

    @ApiPropertyOptional({ example: 'Asia/Yerevan' })
    @IsOptional()
    @IsTimeZone()
    timezone?: string;
}
