import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsMongoId, IsNumber, IsOptional, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

export class DentistRateDto {
    @IsMongoId()
    dentistId: string;

    @ApiPropertyOptional({ nullable: true, description: '% of collected; null = use the clinic default' })
    @ValidateIf((_, v) => v !== null)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    rate: number | null;
}

/** F11: the clinic's default commission % and per-dentist overrides. */
export class SetCommissionRatesDto {
    @ApiPropertyOptional({ example: 30 })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    defaultRate?: number;

    @ApiPropertyOptional({ type: [DentistRateDto] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => DentistRateDto)
    dentists?: DentistRateDto[];
}
