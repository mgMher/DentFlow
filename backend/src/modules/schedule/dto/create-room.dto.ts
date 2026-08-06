import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreateRoomDto {
    @ApiProperty({ example: 'Room 1', description: 'Treatment room name' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Main operatory with panoramic X-ray' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        example: ['Dental chair', 'X-ray unit', 'Autoclave'],
        description: 'List of equipment in the room',
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    equipment?: string[];
}
