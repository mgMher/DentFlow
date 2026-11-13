import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { AddGuardianDto, UpdateGuardianDto } from './dto/family.dto';
import { FamilyService } from './family.service';

/** Same people who may edit a patient (patients.controller PATIENT_EDITORS). */
const PATIENT_EDITORS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST, Role.RECEPTIONIST];
const oid = (id: string) => new Types.ObjectId(id);

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients/:id')
export class FamilyController {
    constructor(private readonly family: FamilyService) {}

    @Get('family')
    @ApiOperation({ summary: "The patient's guardians, children and siblings (F8)" })
    get(@CurrentUser('clinicId') clinicId: string, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.family.family(oid(clinicId), id);
    }

    @Post('guardians')
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'Add a guardian: a patient of the clinic or a contact' })
    addGuardian(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: AddGuardianDto,
    ) {
        return this.family.addGuardian(oid(clinicId), id, dto);
    }

    @Patch('guardians/:guardianId')
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'Change the relationship, make main guardian, or correct a contact' })
    updateGuardian(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Param('guardianId', ParseObjectIdPipe) guardianId: Types.ObjectId,
        @Body() dto: UpdateGuardianDto,
    ) {
        return this.family.updateGuardian(oid(clinicId), id, guardianId, dto);
    }

    @Delete('guardians/:guardianId')
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'Remove a guardian' })
    removeGuardian(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Param('guardianId', ParseObjectIdPipe) guardianId: Types.ObjectId,
    ) {
        return this.family.removeGuardian(oid(clinicId), id, guardianId);
    }
}
