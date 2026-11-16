import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsMongoId,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { Trim } from 'src/common/decorators';
import { PD_MAX, REC_MAX, REC_MIN } from '../perio-exam.schema';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePerioExamDto {
    @ApiPropertyOptional({ example: '2026-11-16', description: "The clinic's day; defaults to today" })
    @IsOptional()
    @Matches(DAY)
    date?: string;

    @ApiPropertyOptional({ description: 'Whose exam; defaults to the dentist recording it' })
    @IsOptional()
    @IsMongoId()
    dentistId?: string;

    @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdatePerioExamDto {
    @ApiPropertyOptional({ example: '2026-11-16' }) @IsOptional() @Matches(DAY) date?: string;

    @ApiPropertyOptional({ nullable: true, description: '`null` clears it' })
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsMongoId()
    dentistId?: string | null;

    @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(2000) notes?: string;
}

export class PerioSiteDto {
    @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: PD_MAX })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(PD_MAX)
    pd?: number | null;

    @ApiPropertyOptional({ nullable: true, minimum: REC_MIN, maximum: REC_MAX, description: 'Recession, mm; negative when the gum is above the CEJ' })
    @IsOptional()
    @IsInt()
    @Min(REC_MIN)
    @Max(REC_MAX)
    rec?: number | null;

    @ApiPropertyOptional() @IsOptional() @IsBoolean() bop?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() sup?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() plaque?: boolean;
}

/** One tooth of an exam, sent whole (autosave); anything left out is cleared. */
export class PerioToothDto {
    @ApiPropertyOptional() @IsOptional() @IsBoolean() missing?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() implant?: boolean;

    @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 3 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(3)
    mobility?: number | null;

    @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 3 })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(3)
    furcation?: number | null;

    @ApiPropertyOptional({ type: [PerioSiteDto], description: 'Six sites: DB, B, MB, DL, L, ML' })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(6)
    @ArrayMaxSize(6)
    @ValidateNested({ each: true })
    @Type(() => PerioSiteDto)
    sites?: PerioSiteDto[];
}

export class RemovePerioExamDto {
    @ApiProperty({ example: 'Entered for the wrong patient' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}
