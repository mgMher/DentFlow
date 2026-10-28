import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';
import { Currency, TreatmentEntryStatus } from '../treatment-entry.schema';
import { ToothStatus, ToothSurface } from '../dental-record.schema';
import { Trim } from 'src/common/decorators';

export class CreateTreatmentEntryDto {
    @ApiPropertyOptional({
        example: [16],
        description: 'FDI tooth numbers. Leave empty for whole-mouth work (exam, X-ray, cleaning).',
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(32)
    @ArrayUnique()
    @IsInt({ each: true })
    teeth?: number[];

    @ApiProperty({ example: 'Composite Filling' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(200)
    treatmentName: string;

    @ApiPropertyOptional({
        enum: TreatmentEntryStatus,
        default: TreatmentEntryStatus.DONE,
        description: '`planned` adds it to the treatment plan; `done` also updates the chart',
    })
    @IsOptional()
    @IsEnum(TreatmentEntryStatus)
    status?: TreatmentEntryStatus;

    @ApiPropertyOptional({
        enum: ToothStatus,
        example: ToothStatus.FILLED,
        description: 'What the teeth become once done. Defaults to the catalogue treatment\'s value.',
    })
    @IsOptional()
    @IsEnum(ToothStatus)
    resultStatus?: ToothStatus;

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
        description: 'When the treatment was performed (or planned). Defaults to now.',
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
    @ArrayUnique()
    @IsEnum(ToothSurface, { each: true })
    surfaces?: ToothSurface[];

    @ApiPropertyOptional({ example: 'Patient tolerated procedure well' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
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

export class CompleteTreatmentEntryDto {
    @ApiPropertyOptional({ example: '2026-10-28', description: 'When it was done. Defaults to now.' })
    @IsOptional()
    @IsDateString()
    date?: string;
}

export class VoidTreatmentEntryDto {
    @ApiProperty({ example: 'Recorded on the wrong patient' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}
