import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Trim } from 'src/common/decorators';
import { SmsProvider } from '../reminder.schemas';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateReminderSettingsDto {
    @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;

    @ApiPropertyOptional() @IsOptional() @IsBoolean() dayBeforeEnabled?: boolean;

    @ApiPropertyOptional({ example: '10:00', description: 'Clinic time, between 08:00 and 20:00' })
    @IsOptional()
    @Matches(HHMM)
    dayBeforeTime?: string;

    @ApiPropertyOptional() @IsOptional() @IsBoolean() hoursBeforeEnabled?: boolean;

    @ApiPropertyOptional({ example: 2 }) @IsOptional() @IsInt() @Min(1) @Max(12) hoursBefore?: number;

    @ApiPropertyOptional({ nullable: true, description: 'From @BotFather; null disconnects the bot' })
    @ValidateIf((_, v) => v !== null)
    @IsOptional()
    @Trim()
    @Matches(/^\d+:[\w-]{20,}$/, { message: 'telegramBotToken does not look like a bot token' })
    telegramBotToken?: string | null;

    @ApiPropertyOptional({ enum: SmsProvider }) @IsOptional() @IsEnum(SmsProvider) smsProvider?: SmsProvider;

    @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(64) twilioAccountSid?: string;

    @ApiPropertyOptional({ nullable: true })
    @ValidateIf((_, v) => v !== null)
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(128)
    twilioAuthToken?: string | null;

    @ApiPropertyOptional({ example: '+15005550006' }) @IsOptional() @Trim() @IsString() @MaxLength(32) twilioFrom?: string;
}

export class TestReminderDto {
    @ApiProperty({ enum: ['telegram', 'sms'] }) @IsIn(['telegram', 'sms']) channel: 'telegram' | 'sms';

    @ApiProperty({ description: 'Patient to send the test to' }) @IsMongoId() patientId: string;
}

export class PatientRemindersDto {
    @ApiProperty() @IsBoolean() optOut: boolean;
}
