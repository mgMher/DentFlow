import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TreatmentCategory, Currency } from '../treatment.schema';

export class PriceDto {
    @ApiProperty({ example: 15000, description: 'Treatment price amount' })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiPropertyOptional({ enum: Currency, default: Currency.AMD, description: 'Currency code' })
    @IsOptional()
    @IsEnum(Currency)
    currency?: Currency;
}

export class CreateTreatmentDto {
    @ApiProperty({ example: 'Tooth Filling', description: 'Treatment name in English' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Ատամի պլdelays', description: 'Treatment name in Armenian' })
    @IsOptional()
    @IsString()
    nameHy?: string;

    @ApiPropertyOptional({ example: 'Пломбирование зуба', description: 'Treatment name in Russian' })
    @IsOptional()
    @IsString()
    nameRu?: string;

    @ApiProperty({
        enum: TreatmentCategory,
        example: TreatmentCategory.GENERAL,
        description: 'Treatment category',
    })
    @IsNotEmpty()
    @IsEnum(TreatmentCategory)
    category: TreatmentCategory;

    @ApiPropertyOptional({ example: 'Composite resin filling for cavities', description: 'Treatment description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 'D2140', description: 'CDT/ICD dental procedure code' })
    @IsOptional()
    @IsString()
    code?: string;

    @ApiPropertyOptional({ example: 30, description: 'Duration in minutes', default: 30 })
    @IsOptional()
    @IsNumber()
    @Min(5)
    duration?: number;

    @ApiPropertyOptional({ type: PriceDto, description: 'Treatment price' })
    @IsOptional()
    @ValidateNested()
    @Type(() => PriceDto)
    price?: PriceDto;

    @ApiPropertyOptional({ example: false, description: 'Whether this is a clinic-specific custom treatment' })
    @IsOptional()
    @IsBoolean()
    isCustom?: boolean;
}
