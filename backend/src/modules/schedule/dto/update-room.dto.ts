import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
} from 'class-validator';

export class UpdateRoomDto {
    @ApiPropertyOptional({ example: 'Operatory A' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'Updated description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: ['Dental chair', 'Ultrasonic scaler'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    equipment?: string[];

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
