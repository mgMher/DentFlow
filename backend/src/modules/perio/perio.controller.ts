import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { PerioService } from './perio.service';
import { CreatePerioExamDto, PerioToothDto, RemovePerioExamDto, UpdatePerioExamDto } from './dto/perio.dto';

/** Assistants often do the probing while the dentist calls out the numbers. */
const RECORDERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST, Role.ASSISTANT];
/** Removing an exam from the record is a clinical decision. */
const REMOVERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];
type AuthUser = { userId: string; clinicId: string; role: Role };
const oid = (id: string) => new Types.ObjectId(id);

/** F12: periodontal charting. Every staff member may read it, like the chart. */
@ApiTags('Periodontal exams')
@ApiBearerAuth()
@Controller()
export class PerioController {
    constructor(private readonly perio: PerioService) {}

    @Get('patients/:patientId/perio-exams')
    @ApiOperation({ summary: "A patient's periodontal exams, newest first, with their figures" })
    list(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId) {
        return this.perio.list(oid(clinicId), patientId);
    }

    @Post('patients/:patientId/perio-exams')
    @Roles(...RECORDERS)
    @ApiOperation({ summary: 'Start an exam: the chart’s teeth, missing teeth and implants already marked' })
    create(@CurrentUser() user: AuthUser, @Param('patientId', ParseObjectIdPipe) patientId: Types.ObjectId, @Body() dto: CreatePerioExamDto) {
        return this.perio.create(oid(user.clinicId), patientId, { userId: oid(user.userId), isDentist: user.role === Role.DENTIST }, dto);
    }

    @Get('perio-exams/:id')
    @ApiOperation({ summary: 'One exam with its figures and the previous exam to compare' })
    findOne(@CurrentUser('clinicId') clinicId: string, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.perio.findOne(oid(clinicId), id);
    }

    @Put('perio-exams/:id/teeth/:toothNumber')
    @Roles(...RECORDERS)
    @ApiOperation({ summary: 'Save one tooth: six sites (depth, recession, bleeding, pus, plaque), mobility, furcation' })
    saveTooth(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Param('toothNumber', ParseIntPipe) toothNumber: number,
        @Body() dto: PerioToothDto,
    ) {
        return this.perio.saveTooth(oid(user.clinicId), id, toothNumber, oid(user.userId), dto);
    }

    @Patch('perio-exams/:id')
    @Roles(...RECORDERS)
    @ApiOperation({ summary: 'Change the date, dentist or notes' })
    update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdatePerioExamDto) {
        return this.perio.update(oid(user.clinicId), id, oid(user.userId), dto);
    }

    @Delete('perio-exams/:id')
    @Roles(...REMOVERS)
    @ApiOperation({ summary: 'Remove from the record (kept, with the reason)' })
    remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: RemovePerioExamDto) {
        return this.perio.remove(oid(user.clinicId), id, oid(user.userId), dto);
    }
}
