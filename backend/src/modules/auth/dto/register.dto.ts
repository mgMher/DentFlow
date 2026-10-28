import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsPassword, PASSWORD_MIN_LENGTH, Trim } from 'src/common/decorators';
import { ARMENIAN_PHONE_E164, ARMENIAN_PHONE_MESSAGE, normalizeArmenianPhone } from 'src/common/utils';

export class RegisterDto {
    @ApiProperty({ example: 'Bright Smile Dental' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(120)
    clinicName: string;

    @ApiProperty({ example: 'admin@brightsmile.com' })
    @Trim()
    @IsNotEmpty()
    @IsEmail()
    @MaxLength(254)
    email: string;

    @ApiProperty({ example: 'StrongP@ss1', minLength: PASSWORD_MIN_LENGTH })
    @IsNotEmpty()
    @IsPassword()
    password: string;

    @ApiProperty({ example: 'Armen' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(60)
    firstName: string;

    @ApiProperty({ example: 'Hakobyan' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(60)
    lastName: string;

    @ApiPropertyOptional({ example: '+374 93 123456' })
    @IsOptional()
    @Transform(({ value }) => normalizeArmenianPhone(value) || undefined)
    @Matches(ARMENIAN_PHONE_E164, { message: `phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone?: string;
}
