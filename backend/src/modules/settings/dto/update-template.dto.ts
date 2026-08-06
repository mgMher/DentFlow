import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
} from 'class-validator';
import { TemplateType, TemplateChannel, TemplateLanguage } from '../notification-template.schema';

export class UpdateTemplateDto {
    @ApiPropertyOptional({ enum: TemplateType })
    @IsOptional()
    @IsEnum(TemplateType)
    type?: TemplateType;

    @ApiPropertyOptional({ enum: TemplateChannel })
    @IsOptional()
    @IsEnum(TemplateChannel)
    channel?: TemplateChannel;

    @ApiPropertyOptional({ example: 'Updated subject' })
    @IsOptional()
    @IsString()
    subject?: string;

    @ApiPropertyOptional({
        example: 'Dear {{patientName}}, reminder for {{date}} at {{time}}.',
        description: 'Template body with placeholders',
    })
    @IsOptional()
    @IsString()
    bodyTemplate?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ enum: TemplateLanguage })
    @IsOptional()
    @IsEnum(TemplateLanguage)
    language?: TemplateLanguage;
}
