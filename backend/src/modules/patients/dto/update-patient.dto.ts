import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PatientStatus } from '../patient.schema';
import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
    @ApiPropertyOptional({ enum: PatientStatus, example: PatientStatus.INACTIVE })
    @IsOptional()
    @IsEnum(PatientStatus)
    status?: PatientStatus;

    @ApiPropertyOptional({
        description: 'Legacy flag. Prefer `status`; kept in sync automatically.',
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdatePatientStatusDto {
    @ApiProperty({ enum: PatientStatus, example: PatientStatus.INACTIVE })
    @IsNotEmpty()
    @IsEnum(PatientStatus)
    status: PatientStatus;

    @ApiPropertyOptional({ example: 'Moved to another city' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
