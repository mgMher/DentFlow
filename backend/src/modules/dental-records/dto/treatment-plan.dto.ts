import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';
import { Trim } from 'src/common/decorators';
import { ToothStatus, ToothSurface } from '../dental-record.schema';
import { TreatmentPlanStatus } from '../treatment-plan.schema';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class QueryTreatmentPlansDto {
    @ApiProperty()
    @IsMongoId()
    patientId: string;

    @ApiPropertyOptional({ enum: TreatmentPlanStatus })
    @IsOptional()
    @IsEnum(TreatmentPlanStatus)
    status?: TreatmentPlanStatus;
}

export class CreateTreatmentPlanDto {
    @ApiProperty()
    @IsMongoId()
    patientId: string;

    @ApiProperty({ example: 'Option A — implant' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(120)
    title: string;

    @ApiPropertyOptional({ description: 'Responsible dentist (auth user id). Defaults to the current user if a dentist.' })
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class UpdateTreatmentPlanDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(120)
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class TreatmentPlanItemDto {
    @ApiPropertyOptional({ example: [36], description: 'FDI tooth numbers; empty for whole-mouth work' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(32)
    @ArrayUnique()
    @IsInt({ each: true })
    teeth?: number[];

    @ApiPropertyOptional({ description: 'Catalogue treatment' })
    @IsOptional()
    @IsMongoId()
    treatmentId?: string;

    @ApiProperty({ example: 'Implant' })
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(200)
    treatmentName: string;

    @ApiPropertyOptional({ enum: ToothSurface, isArray: true })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsEnum(ToothSurface, { each: true })
    surfaces?: ToothSurface[];

    @ApiPropertyOptional({ enum: ToothStatus, description: 'What the teeth become once done' })
    @IsOptional()
    @IsEnum(ToothStatus)
    resultStatus?: ToothStatus;

    @ApiPropertyOptional({ description: 'Dentist who will do it. Defaults to the plan dentist.' })
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiProperty({ example: 250000, description: 'Price in the clinic currency (major units)' })
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(1_000_000_000)
    cost: number;

    @ApiPropertyOptional({ example: 10, description: 'Percent off' })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    discount?: number;

    @ApiPropertyOptional({ example: 1, description: 'Stage / visit the item is grouped under' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    stage?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class PresentTreatmentPlanDto {
    @ApiPropertyOptional({ example: '2026-12-31', description: 'Estimate valid until (clinic day). Defaults to 30 days.' })
    @IsOptional()
    @Matches(DAY)
    validUntil?: string;
}

export class AcceptTreatmentPlanDto {
    @ApiProperty({ description: 'The plan revision the patient was shown' })
    @IsInt()
    @Min(0)
    revision: number;

    @ApiPropertyOptional({ description: 'Items the patient declined', isArray: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @IsMongoId({ each: true })
    declinedItemIds?: string[];
}

export class CloseTreatmentPlanDto {
    @ApiProperty({ example: 'Patient chose option B' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}

export class DuplicateTreatmentPlanDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(120)
    title?: string;
}
