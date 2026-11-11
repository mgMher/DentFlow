import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword, PASSWORD_MIN_LENGTH } from 'src/common/decorators';

export class ChangePasswordDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    currentPassword: string;

    @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
    @IsNotEmpty()
    @IsPassword()
    newPassword: string;
}

/** Admin sets a new password for a staff member (no current password needed). */
export class ResetPasswordDto {
    @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
    @IsNotEmpty()
    @IsPassword()
    newPassword: string;
}
