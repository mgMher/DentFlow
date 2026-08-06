import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEmail,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from 'src/common/decorators';

export class CreateDayAvailabilityDto {
    @ApiProperty({ example: 1, description: '0 = Sunday, 6 = Saturday' })
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek: number;

    @ApiProperty({ example: '09:00' })
    @IsString()
    startTime: string;

    @ApiProperty({ example: '18:00' })
    @IsString()
    endTime: string;
}

export class CreateUserDto {
    @ApiProperty({ example: 'Armen' })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Hakobyan' })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiPropertyOptional({ example: 'Vahanovich', description: 'Patronymic (Armenian naming)' })
    @IsOptional()
    @IsString()
    patronymic?: string;

    @ApiProperty({ example: 'armen@brightsmile.am' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'StrongP@ss1', minLength: 6 })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({ example: '+374 93 123456' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ enum: Role, example: Role.DENTIST })
    @IsNotEmpty()
    @IsEnum(Role)
    role: Role;

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

    @ApiPropertyOptional({ type: [CreateDayAvailabilityDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDayAvailabilityDto)
    defaultAvailability?: CreateDayAvailabilityDto[];
}
