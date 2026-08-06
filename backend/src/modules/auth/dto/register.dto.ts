import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'Bright Smile Dental' })
    @IsNotEmpty()
    @IsString()
    clinicName: string;

    @ApiProperty({ example: 'admin@brightsmile.com' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'StrongP@ss1', minLength: 6 })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'Armen' })
    @IsNotEmpty()
    @IsString()
    firstName: string;

    @ApiProperty({ example: 'Hakobyan' })
    @IsNotEmpty()
    @IsString()
    lastName: string;

    @ApiPropertyOptional({ example: '+374 93 123456' })
    @IsOptional()
    @IsString()
    phone?: string;
}
