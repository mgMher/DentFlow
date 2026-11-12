import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators';
import { DocumentKind } from '../patient-document.schema';

/** Multipart sends text: "16,17" or "[16,17]" both become [16, 17]. */
const toTeeth = ({ value }: { value: unknown }) => {
    if (Array.isArray(value)) return value.map(Number);
    if (typeof value !== 'string' || !value.trim()) return [];
    const text = value.trim().startsWith('[') ? (JSON.parse(value) as unknown[]).join(',') : value;
    return text.split(',').map((x) => Number(x.trim()));
};

export class UploadDocumentDto {
    @ApiProperty({ enum: DocumentKind }) @IsEnum(DocumentKind) kind: DocumentKind;

    @ApiPropertyOptional({ description: "Defaults to the file's name" })
    @IsOptional()
    @Trim()
    @IsString()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ example: '16,17', description: 'FDI tooth numbers' })
    @IsOptional()
    @Transform(toTeeth)
    @IsArray()
    @ArrayMaxSize(32)
    @ArrayUnique()
    @IsInt({ each: true })
    teeth?: number[];

    @ApiPropertyOptional({ example: '2026-11-12', description: 'When it was taken; defaults to now' })
    @IsOptional()
    @IsDateString()
    takenAt?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateDocumentDto {
    @ApiPropertyOptional({ enum: DocumentKind }) @IsOptional() @IsEnum(DocumentKind) kind?: DocumentKind;

    @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MinLength(1) @MaxLength(200) title?: string;

    @ApiPropertyOptional({ type: [Number] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(32)
    @ArrayUnique()
    @IsInt({ each: true })
    teeth?: number[];

    @ApiPropertyOptional() @IsOptional() @IsDateString() takenAt?: string;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class QueryDocumentsDto {
    @ApiPropertyOptional({ enum: DocumentKind }) @IsOptional() @IsEnum(DocumentKind) kind?: DocumentKind;

    @ApiPropertyOptional({ description: 'Only documents about this tooth' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    tooth?: number;
}

export class RemoveDocumentDto {
    @ApiProperty({ example: 'Uploaded to the wrong patient' })
    @Trim()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason: string;
}
