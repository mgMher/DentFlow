import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'admin@brightsmile.com' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'StrongP@ss1' })
    @IsNotEmpty()
    @IsString()
    password: string;

    /** F9: a device trusted for 30 days skips the two-factor code. */
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    trustedDevice?: string;
}
