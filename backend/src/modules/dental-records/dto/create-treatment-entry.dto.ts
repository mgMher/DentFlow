import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { Currency } from '../treatment-entry.schema';
import { ToothSurface } from '../dental-record.schema';

export class CreateTreatmentEntryDto {
    @ApiProperty({
        example: 14,
        description: 'Universal tooth number: 1-32 for adult, 51-70 for pediatric',
    })
    @IsNotEmpty()
    @IsInt()
    toothNumber: number;

    @ApiProperty({ example: 'Composite Filling' })
    @IsNotEmpty()
    @IsString()
    treatmentName: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011', description: 'Reference to Treatment catalog' })
    @IsOptional()
    @IsMongoId()
    treatmentId?: string;

    @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012', description: 'Associated appointment ID' })
    @IsOptional()
    @IsMongoId()
    appointmentId?: string;

    @ApiPropertyOptional({
        example: '507f1f77bcf86cd799439013',
        description: 'Dentist who performed the treatment. Defaults to the current user.',
    })
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiPropertyOptional({
        example: '2026-09-09',
        description: 'When the treatment was performed. Defaults to now.',
    })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({
        enum: ToothSurface,
        isArray: true,
        example: [ToothSurface.MESIAL, ToothSurface.OCCLUSAL],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(ToothSurface, { each: true })
    surfaces?: ToothSurface[];

    @ApiPropertyOptional({ example: 'Patient tolerated procedure well' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({ example: 25000, description: 'Treatment cost' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cost?: number;

    @ApiPropertyOptional({ enum: Currency, example: Currency.AMD })
    @IsOptional()
    @IsEnum(Currency)
    currency?: Currency;
}
