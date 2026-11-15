import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** How a column's cells are written: real numbers and dates in Excel, plain values in CSV. */
export const COLUMN_TYPES = ['text', 'number', 'money', 'percent', 'date', 'datetime'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const MAX_ROWS = 5000;

export class ExportColumnDto {
    @ApiProperty({ example: 'Collected' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    header: string;

    @ApiProperty({ enum: COLUMN_TYPES })
    @IsIn(COLUMN_TYPES as unknown as string[])
    type: ColumnType;

    @ApiPropertyOptional({ description: 'Excel column width in characters' })
    @IsOptional()
    @IsInt()
    @Min(4)
    @Max(80)
    width?: number;
}

export class ExportSheetDto {
    @ApiProperty({ example: 'Dentists' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    name: string;

    @ApiProperty({ type: [ExportColumnDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(40)
    @ValidateNested({ each: true })
    @Type(() => ExportColumnDto)
    columns: ExportColumnDto[];

    @ApiProperty({ description: 'Rows of cells: string, number or null; dates as YYYY-MM-DD or YYYY-MM-DDTHH:mm (wall time)' })
    @IsArray()
    @ArrayMaxSize(MAX_ROWS)
    rows: unknown[][];
}

/**
 * F11: a table the page already shows (headers in the user's language),
 * written as an Excel workbook (one sheet each) or one CSV file.
 */
export class ExportDto {
    @ApiProperty({ enum: EXPORT_FORMATS })
    @IsIn(EXPORT_FORMATS as unknown as string[])
    format: ExportFormat;

    @ApiProperty({ example: 'report-2026-11' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    filename: string;

    @ApiPropertyOptional({ description: 'Decimals for money columns (0 for AMD, 2 for USD / RUB)' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(4)
    moneyDecimals?: number;

    @ApiProperty({ type: [ExportSheetDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => ExportSheetDto)
    sheets: ExportSheetDto[];
}
