import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ToothStatus } from '../dental-record.schema';

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
        example: ['mesial', 'occlusal'],
        description: 'Affected surfaces: mesial, distal, occlusal, buccal, lingual',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    surfaces?: string[];

    @ApiPropertyOptional({ example: ['caries', 'fracture'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    conditions?: string[];

    @ApiPropertyOptional({ example: 'Composite filling placed on mesial surface' })
    @IsOptional()
    @IsString()
    notes?: string;
}
