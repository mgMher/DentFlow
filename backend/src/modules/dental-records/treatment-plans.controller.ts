import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { TreatmentPlansService } from './treatment-plans.service';
import {
    AcceptTreatmentPlanDto,
    CloseTreatmentPlanDto,
    CreateTreatmentPlanDto,
    DuplicateTreatmentPlanDto,
    PresentTreatmentPlanDto,
    QueryTreatmentPlansDto,
    TreatmentPlanItemDto,
    UpdateTreatmentPlanDto,
} from './dto';

/** Dentists and admins build plans and set prices; reception may also record the patient's answer. Everyone views. */
const PLAN_EDITORS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST];
const PLAN_DECIDERS = [...PLAN_EDITORS, Role.RECEPTIONIST];

type AuthUser = { userId: string; clinicId: string; role: Role };
const oid = (id: string) => new Types.ObjectId(id);

@ApiTags('Treatment Plans')
@ApiBearerAuth()
@Controller('treatment-plans')
export class TreatmentPlansController {
    constructor(private readonly plans: TreatmentPlansService) {}

    @Get()
    @ApiOperation({ summary: "A patient's treatment plans, newest first, with totals" })
    findAll(@CurrentUser('clinicId') clinicId: string, @Query() query: QueryTreatmentPlansDto) {
        return this.plans.findAll(oid(clinicId), query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'One plan with its items, totals and history' })
    findOne(@CurrentUser('clinicId') clinicId: string, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.plans.findOne(oid(clinicId), id);
    }

    @Post()
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Start a draft plan for a patient' })
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateTreatmentPlanDto) {
        return this.plans.create(oid(user.clinicId), oid(user.userId), user.role, dto);
    }

    @Patch(':id')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Change title, notes or dentist (draft only)' })
    update(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateTreatmentPlanDto,
    ) {
        return this.plans.update(oid(clinicId), id, dto);
    }

    @Post(':id/items')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Add a treatment to the plan (draft only)' })
    addItem(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: TreatmentPlanItemDto,
    ) {
        return this.plans.addItem(oid(user.clinicId), id, oid(user.userId), dto);
    }

    @Patch(':id/items/:itemId')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Change a treatment on the plan (draft only)' })
    updateItem(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Param('itemId', ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() dto: TreatmentPlanItemDto,
    ) {
        return this.plans.updateItem(oid(clinicId), id, itemId, dto);
    }

    @Delete(':id/items/:itemId')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Remove a treatment from the plan (draft only)' })
    removeItem(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Param('itemId', ParseObjectIdPipe) itemId: Types.ObjectId,
    ) {
        return this.plans.removeItem(oid(clinicId), id, itemId);
    }

    @Patch(':id/present')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Mark the estimate as given to the patient' })
    present(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: PresentTreatmentPlanDto,
    ) {
        return this.plans.present(oid(user.clinicId), id, oid(user.userId), dto);
    }

    @Patch(':id/accept')
    @Roles(...PLAN_DECIDERS)
    @ApiOperation({ summary: "Record the patient's acceptance, with any items they declined" })
    accept(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: AcceptTreatmentPlanDto,
    ) {
        return this.plans.accept(oid(user.clinicId), id, oid(user.userId), dto);
    }

    @Patch(':id/decline')
    @Roles(...PLAN_DECIDERS)
    @ApiOperation({ summary: 'The patient declined the whole plan' })
    decline(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: CloseTreatmentPlanDto,
    ) {
        return this.plans.decline(oid(user.clinicId), id, oid(user.userId), dto);
    }

    @Patch(':id/revise')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Send a presented or accepted plan back to draft' })
    revise(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        return this.plans.revise(oid(user.clinicId), id, oid(user.userId));
    }

    @Patch(':id/cancel')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Withdraw the plan (done items stay)' })
    cancel(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: CloseTreatmentPlanDto,
    ) {
        return this.plans.cancel(oid(user.clinicId), id, oid(user.userId), dto);
    }

    @Post(':id/duplicate')
    @Roles(...PLAN_EDITORS)
    @ApiOperation({ summary: 'Copy into a new draft (an alternative, or to re-offer)' })
    duplicate(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: DuplicateTreatmentPlanDto,
    ) {
        return this.plans.duplicate(oid(user.clinicId), id, oid(user.userId), dto);
    }
}
