import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { SurfaceStatus, ToothStatus, ToothSurface } from '../dental-record.schema';

export class SurfaceStateDto {
    @ApiProperty({ enum: ToothSurface, example: ToothSurface.MESIAL })
    @IsEnum(ToothSurface)
    surface: ToothSurface;

    @ApiProperty({ enum: SurfaceStatus, example: SurfaceStatus.DECAYED })
    @IsEnum(SurfaceStatus)
    status: SurfaceStatus;
}

export class UpdateToothDto {
    @ApiProperty({ example: 16, description: 'FDI tooth number (11–48, primary 51–85)' })
    @IsNotEmpty()
    @IsInt()
    toothNumber: number;

    @ApiPropertyOptional({ enum: ToothStatus, example: ToothStatus.FILLED })
    @IsOptional()
    @IsEnum(ToothStatus)
    status?: ToothStatus;

    @ApiPropertyOptional({
        type: [SurfaceStateDto],
        description: 'Replaces the surface findings. One entry per surface; a surface not listed is sound.',
        example: [
            { surface: ToothSurface.MESIAL, status: SurfaceStatus.DECAYED },
            { surface: ToothSurface.OCCLUSAL, status: SurfaceStatus.FILLED },
        ],
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(Object.keys(ToothSurface).length)
    @ValidateNested({ each: true })
    @Type(() => SurfaceStateDto)
    surfaces?: SurfaceStateDto[];

    @ApiPropertyOptional({ example: ['caries', 'fracture'] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(120, { each: true })
    conditions?: string[];

    @ApiPropertyOptional({ example: 'Composite filling placed on mesial surface' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class UpdateTeethDto {
    @ApiProperty({ type: [UpdateToothDto] })
    @IsArray()
    @ArrayMaxSize(52)
    @ValidateNested({ each: true })
    @Type(() => UpdateToothDto)
    teeth: UpdateToothDto[];
}

export class SetChartTypeDto {
    @ApiProperty({ enum: ['adult', 'pediatric', 'mixed'], example: 'mixed' })
    @IsNotEmpty()
    @IsIn(['adult', 'pediatric', 'mixed'])
    chartType: 'adult' | 'pediatric' | 'mixed';
}

export class GetChartQueryDto {
    @ApiPropertyOptional({
        enum: ['adult', 'pediatric', 'mixed'],
        description: 'Only used when the chart does not exist yet',
    })
    @IsOptional()
    @IsIn(['adult', 'pediatric', 'mixed'])
    chartType?: 'adult' | 'pediatric' | 'mixed';
}

/** F12: a permanent tooth in a mixed chart (its primary predecessor, if any, is replaced). */
export class EruptToothDto {
    @ApiProperty({ example: 11, description: 'FDI number of the permanent tooth' })
    @IsInt()
    toothNumber: number;
}
