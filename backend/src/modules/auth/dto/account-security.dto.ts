import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPassword, PASSWORD_MIN_LENGTH } from 'src/common/decorators';

/** F9: ask for a reset link. The answer is the same whether or not the email has an account. */
export class ForgotPasswordDto {
    @ApiProperty({ example: 'anna@clinic.am' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail()
    @MaxLength(200)
    email: string;
}

export class ResetPasswordWithTokenDto {
    @ApiProperty({ description: 'From the emailed link' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(200)
    token: string;

    @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
    @IsNotEmpty()
    @IsPassword()
    newPassword: string;
}

/** A 6-digit app code or a backup code. */
export class TwoFactorCodeDto {
    @ApiProperty({ example: '123456' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(20)
    code: string;
}

export class TwoFactorChallengeDto {
    @ApiProperty({ description: 'From the password step' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(2000)
    challenge: string;
}

export class TwoFactorLoginDto extends TwoFactorChallengeDto {
    @ApiProperty({ example: '123456' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(20)
    code: string;

    @ApiPropertyOptional({ description: 'Skip the code on this browser for 30 days' })
    @IsOptional()
    @IsBoolean()
    trustDevice?: boolean;
}
