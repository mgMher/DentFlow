import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
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
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Role } from 'src/common/decorators';
import { ARMENIAN_PHONE, TIME_OF_DAY } from './create-user.dto';
import { STAFF_ROLES } from './query-user.dto';

const trim = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class UpdateDayAvailabilityDto {
    @ApiPropertyOptional({ example: 1, description: '0 = Sunday, 6 = Saturday' })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiPropertyOptional({ example: '09:00' })
    @IsString()
    @Matches(TIME_OF_DAY, { message: 'startTime must be in HH:MM format' })
    startTime: string;

    @ApiPropertyOptional({ example: '18:00' })
    @IsString()
    @Matches(TIME_OF_DAY, { message: 'endTime must be in HH:MM format' })
    endTime: string;
}

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'Armen' })
    @IsOptional()
    @Transform(trim)
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    firstName?: string;

    @ApiPropertyOptional({ example: 'Hakobyan' })
    @IsOptional()
    @Transform(trim)
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    lastName?: string;

    @ApiPropertyOptional({ example: 'Vahanovich' })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(100)
    patronymic?: string;

    @ApiPropertyOptional({ example: 'armen@brightsmile.am' })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail({}, { message: 'email must be a valid email address' })
    @MaxLength(254)
    email?: string;

    @ApiPropertyOptional({
        example: '+37493123456',
        description: 'Empty string clears the stored number',
    })
    @IsOptional()
    @Transform(trim)
    @IsString()
    @ValidateIf((dto: UpdateUserDto) => dto.phone !== '')
    @Matches(ARMENIAN_PHONE, {
        message: 'phone must be an Armenian number, e.g. +37493123456',
    })
    phone?: string;

    @ApiPropertyOptional({ enum: STAFF_ROLES, example: Role.DENTIST })
    @IsOptional()
    @IsIn(STAFF_ROLES as unknown as string[], { message: 'role is not a valid staff role' })
    role?: Role;

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

    @ApiPropertyOptional({ description: 'Activate or deactivate the account' })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false') return false;
        return value;
    })
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ type: [UpdateDayAvailabilityDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateDayAvailabilityDto)
    defaultAvailability?: UpdateDayAvailabilityDto[];
}

export class UpdateUserStatusDto {
    @ApiPropertyOptional({ description: 'Activate (true) or deactivate (false) the account' })
    @Transform(({ value }) => {
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false') return false;
        return value;
    })
    @IsBoolean()
    isActive: boolean;
}

export class UpdateAvailabilityDto {
    @ApiPropertyOptional({ type: [UpdateDayAvailabilityDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateDayAvailabilityDto)
    defaultAvailability: UpdateDayAvailabilityDto[];
}
