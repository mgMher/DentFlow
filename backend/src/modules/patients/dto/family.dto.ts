import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Trim } from 'src/common/decorators';
import { ARMENIAN_PHONE_E164, ARMENIAN_PHONE_MESSAGE } from 'src/common/utils';
import { GuardianRelationship } from '../patient.schema';
import { toArmenianPhone } from './create-patient.dto';

/** A guardian is a patient of the clinic (`patientId`) or a contact (`name` + `phone`). */
export class AddGuardianDto {
    @ApiPropertyOptional({ description: 'A patient of the clinic; leave out for a contact' })
    @IsOptional()
    @IsMongoId()
    patientId?: string;

    @ApiPropertyOptional({ example: 'Anna Petrosyan', description: 'Contact who is not a patient' })
    @ValidateIf((o) => !o.patientId)
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(150)
    name?: string;

    @ApiPropertyOptional({ example: '+37491123456' })
    @ValidateIf((o) => !o.patientId)
    @Transform(toArmenianPhone)
    @IsNotEmpty()
    @IsString()
    @Matches(ARMENIAN_PHONE_E164, { message: `phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone?: string;

    @ApiProperty({ enum: GuardianRelationship })
    @IsEnum(GuardianRelationship)
    relationship: GuardianRelationship;

    @ApiPropertyOptional({ description: 'The main guardian (the first one is, by default)' })
    @IsOptional()
    @IsBoolean()
    isPrimary?: boolean;
}

export class UpdateGuardianDto {
    @ApiPropertyOptional({ enum: GuardianRelationship })
    @IsOptional()
    @IsEnum(GuardianRelationship)
    relationship?: GuardianRelationship;

    @ApiPropertyOptional({ description: 'Make this the main guardian' })
    @IsOptional()
    @IsBoolean()
    isPrimary?: boolean;

    @ApiPropertyOptional({ description: 'Contacts only' })
    @IsOptional()
    @Trim()
    @IsNotEmpty()
    @IsString()
    @MaxLength(150)
    name?: string;

    @ApiPropertyOptional({ description: 'Contacts only' })
    @IsOptional()
    @Transform(toArmenianPhone)
    @IsString()
    @Matches(ARMENIAN_PHONE_E164, { message: `phone ${ARMENIAN_PHONE_MESSAGE}` })
    phone?: string;
}
