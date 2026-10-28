import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEmail,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsPassword, PASSWORD_MIN_LENGTH, Role, TIME_OF_DAY } from 'src/common/decorators';
import { STAFF_ROLES } from './query-user.dto';

/** `+374` followed by the 8-digit national significant number. */
export const ARMENIAN_PHONE = /^\+374\d{8}$/;

export { TIME_OF_DAY };
/** @deprecated use PASSWORD_MIN_LENGTH from src/common/decorators */
export const MIN_PASSWORD_LENGTH = PASSWORD_MIN_LENGTH;

const trim = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class CreateDayAvailabilityDto {
    @ApiProperty({ example: 1, description: '0 = Sunday, 6 = Saturday' })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiProperty({ example: '09:00' })
    @IsString()
    @Matches(TIME_OF_DAY, { message: 'startTime must be in HH:MM format' })
    startTime: string;

    @ApiProperty({ example: '18:00' })
    @IsString()
    @Matches(TIME_OF_DAY, { message: 'endTime must be in HH:MM format' })
    endTime: string;
}

export class CreateUserDto {
    @ApiProperty({ example: 'Armen' })
    @Transform(trim)
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    firstName: string;

    @ApiProperty({ example: 'Hakobyan' })
    @Transform(trim)
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    lastName: string;

    @ApiPropertyOptional({ example: 'Vahanovich', description: 'Patronymic (Armenian naming)' })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(100)
    patronymic?: string;

    @ApiProperty({ example: 'armen@brightsmile.am' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsNotEmpty()
    @IsEmail({}, { message: 'email must be a valid email address' })
    @MaxLength(254)
    email: string;

    @ApiProperty({ example: 'StrongP@ss1', minLength: PASSWORD_MIN_LENGTH })
    @IsNotEmpty()
    @IsPassword()
    password: string;

    @ApiPropertyOptional({ example: '+37493123456' })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @Matches(ARMENIAN_PHONE, { message: 'phone must be an Armenian number, e.g. +37493123456' })
    phone?: string;

    @ApiProperty({ enum: STAFF_ROLES, example: Role.DENTIST })
    @IsNotEmpty()
    @IsIn(STAFF_ROLES as unknown as string[], { message: 'role is not a valid staff role' })
    role: Role;

    @ApiPropertyOptional({ example: 'orthodontics' })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(120)
    specialization?: string;

    @ApiPropertyOptional({ example: 'DL-2024-12345' })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(60)
    licenseNumber?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/armen.jpg' })
    @IsOptional()
    @IsString()
    avatar?: string;

    @ApiPropertyOptional({ type: [CreateDayAvailabilityDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDayAvailabilityDto)
    defaultAvailability?: CreateDayAvailabilityDto[];
}
