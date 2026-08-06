import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsEmail,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from 'src/common/decorators';

export class UpdateDayAvailabilityDto {
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
}

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'Armen' })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Hakobyan' })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiPropertyOptional({ example: 'Vahanovich' })
    @IsOptional()
    @IsString()
    patronymic?: string;

    @ApiPropertyOptional({ example: 'armen@brightsmile.am' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: '+374 93 123456' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ enum: Role, example: Role.DENTIST })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiPropertyOptional({ example: 'Orthodontist' })
    @IsOptional()
    @IsString()
    specialization?: string;

    @ApiPropertyOptional({ example: 'DL-2024-12345' })
    @IsOptional()
    @IsString()
    licenseNumber?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/armen.jpg' })
    @IsOptional()
    @IsString()
    avatar?: string;

    @ApiPropertyOptional({ type: [UpdateDayAvailabilityDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateDayAvailabilityDto)
    defaultAvailability?: UpdateDayAvailabilityDto[];
}
