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
import { ToothStatus, ToothSurface } from '../dental-record.schema';

export class UpdateToothDto {
    @ApiProperty({
        example: 14,
        description: 'Universal tooth number: 1-32 for adult, 51-70 for pediatric (A-T mapped)',
    })
    @IsNotEmpty()
    @IsInt()
    toothNumber: number;

    @ApiPropertyOptional({ enum: ToothStatus, example: ToothStatus.FILLED })
    @IsOptional()
    @IsEnum(ToothStatus)
    status?: ToothStatus;

    @ApiPropertyOptional({
        enum: ToothSurface,
        isArray: true,
        example: [ToothSurface.MESIAL, ToothSurface.OCCLUSAL],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(ToothSurface, { each: true })
    surfaces?: ToothSurface[];

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
    @ApiProperty({ enum: ['adult', 'pediatric'], example: 'pediatric' })
    @IsNotEmpty()
    @IsIn(['adult', 'pediatric'])
    chartType: 'adult' | 'pediatric';
}
