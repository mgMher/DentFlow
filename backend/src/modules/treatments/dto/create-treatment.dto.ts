import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
    IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsOptionalNotNull, Trim } from 'src/common/decorators';
import { ToothStatus } from 'src/modules/dental-records/dental-record.schema';
import { Currency } from 'src/common/utils';
import { TreatmentCategory } from '../treatment.schema';

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
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(200)
    name: string;

    // Optional text fields: an empty string clears the field on update.

    @ApiPropertyOptional({ example: 'Ատամի լցավորում', description: 'Treatment name in Armenian' })
    @Trim()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    nameHy?: string;

    @ApiPropertyOptional({ example: 'Пломбирование зуба', description: 'Treatment name in Russian' })
    @Trim()
    @IsOptional()
    @IsString()
    @MaxLength(200)
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
    @Trim()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    description?: string;

    @ApiPropertyOptional({ example: 'D2140', description: 'Clinic code, unique per clinic (stored upper-case)' })
    @Trim()
    @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
    @IsOptional()
    @IsString()
    @MaxLength(40)
    code?: string;

    @ApiPropertyOptional({
        enum: [...Object.values(ToothStatus), ''],
        example: ToothStatus.FILLED,
        description: 'What the tooth becomes once done; prefills chart entries. Empty string clears it.',
    })
    @IsOptional()
    @IsIn([...Object.values(ToothStatus), ''])
    toothStatus?: ToothStatus | '';

    @ApiPropertyOptional({ example: 30, description: 'Duration in minutes', default: 30 })
    @IsOptionalNotNull()
    @IsNumber()
    @Min(5)
    @Max(480)
    duration?: number;

    @ApiPropertyOptional({ type: PriceDto, description: 'Treatment price' })
    @IsOptionalNotNull()
    @ValidateNested()
    @Type(() => PriceDto)
    price?: PriceDto;

    @ApiPropertyOptional({ example: false, description: 'Whether this is a clinic-specific custom treatment' })
    @IsOptional()
    @IsBoolean()
    isCustom?: boolean;
}
