import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const SUPPORT_ACCESS_HOURS = [1, 4, 24, 72] as const;

export class SupportAccessDto {
    @ApiProperty({ enum: SUPPORT_ACCESS_HOURS, example: 4 })
    @IsIn(SUPPORT_ACCESS_HOURS as unknown as number[])
    hours: number;
}
