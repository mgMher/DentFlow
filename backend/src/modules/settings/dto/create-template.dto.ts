import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { TemplateType, TemplateChannel, TemplateLanguage } from '../notification-template.schema';

export class CreateTemplateDto {
    @ApiProperty({ enum: TemplateType, example: TemplateType.APPOINTMENT_REMINDER })
    @IsNotEmpty()
    @IsEnum(TemplateType)
    type: TemplateType;

    @ApiProperty({ enum: TemplateChannel, example: TemplateChannel.SMS })
    @IsNotEmpty()
    @IsEnum(TemplateChannel)
    channel: TemplateChannel;

    @ApiPropertyOptional({ example: 'Appointment Reminder' })
    @IsOptional()
    @IsString()
    subject?: string;

    @ApiProperty({
        example: 'Dear {{patientName}}, your appointment is on {{date}} at {{time}} with Dr. {{dentistName}}.',
        description: 'Template body with placeholders: {{patientName}}, {{date}}, {{time}}, {{dentistName}}',
    })
    @IsNotEmpty()
    @IsString()
    bodyTemplate: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ enum: TemplateLanguage, default: TemplateLanguage.HY })
    @IsOptional()
    @IsEnum(TemplateLanguage)
    language?: TemplateLanguage;
}
