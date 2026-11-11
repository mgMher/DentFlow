import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { TreatmentsService } from './treatments.service';
import { TreatmentCategory } from './treatment.schema';
import { CreateTreatmentDto, UpdateTreatmentDto, QueryTreatmentDto } from './dto';

/** Role matrix (D5): prices and the catalogue belong to the clinic admin; everyone else views. */
const CATALOG_EDITORS = [Role.CLINIC_ADMIN];

@ApiTags('Treatments')
@ApiBearerAuth()
@Controller('treatments')
export class TreatmentsController {
    constructor(private readonly treatmentsService: TreatmentsService) {}

    @Get()
    @ApiOperation({ summary: 'List all treatments for the current clinic' })
    @ApiResponse({ status: 200, description: 'Paginated list of treatments' })
    async findAll(
        @CurrentUser('clinicId') clinicId: string,
        @Query() query: QueryTreatmentDto,
    ) {
        return this.treatmentsService.findAll(new Types.ObjectId(clinicId), query);
    }

    @Post()
    @Roles(...CATALOG_EDITORS)
    @ApiOperation({ summary: 'Create a new treatment (admin only)' })
    @ApiResponse({ status: 201, description: 'Treatment created' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @ApiResponse({ status: 409, description: 'Code already used (treatmentCodeTaken)' })
    async create(
        @CurrentUser('clinicId') clinicId: string,
        @Body() dto: CreateTreatmentDto,
    ) {
        return this.treatmentsService.create(new Types.ObjectId(clinicId), dto);
    }

    @Get('categories')
    @ApiOperation({ summary: 'List all available treatment categories' })
    @ApiResponse({ status: 200, description: 'Array of category values' })
    getCategories() {
        return Object.values(TreatmentCategory);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a treatment by ID' })
    @ApiParam({ name: 'id', description: 'Treatment ObjectId' })
    @ApiResponse({ status: 200, description: 'Treatment details' })
    @ApiResponse({ status: 404, description: 'Treatment not found' })
    async findById(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.treatmentsService.findById(new Types.ObjectId(clinicId), id);
    }

    @Patch(':id')
    @Roles(...CATALOG_EDITORS)
    @ApiOperation({ summary: 'Update a treatment (admin only); an empty optional field clears it' })
    @ApiParam({ name: 'id', description: 'Treatment ObjectId' })
    @ApiResponse({ status: 200, description: 'Treatment updated' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Treatment not found' })
    async update(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateTreatmentDto,
    ) {
        return this.treatmentsService.update(new Types.ObjectId(clinicId), id, dto);
    }

    @Delete(':id')
    @Roles(...CATALOG_EDITORS)
    @ApiOperation({ summary: 'Deactivate a treatment (hidden from pickers, admin only)' })
    @ApiParam({ name: 'id', description: 'Treatment ObjectId' })
    @ApiResponse({ status: 200, description: 'Treatment deactivated' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Treatment not found' })
    async deactivate(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.treatmentsService.setActive(new Types.ObjectId(clinicId), id, false);
    }

    @Patch(':id/reactivate')
    @Roles(...CATALOG_EDITORS)
    @ApiOperation({ summary: 'Bring a deactivated treatment back (admin only)' })
    @ApiParam({ name: 'id', description: 'Treatment ObjectId' })
    @ApiResponse({ status: 200, description: 'Treatment active again' })
    async reactivate(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.treatmentsService.setActive(new Types.ObjectId(clinicId), id, true);
    }

    @Post('seed-defaults')
    @Roles(...CATALOG_EDITORS)
    @ApiOperation({ summary: 'Seed default treatments for the clinic (admin only)' })
    @ApiResponse({ status: 201, description: 'Default treatments seeded' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions' })
    async seedDefaults(@CurrentUser('clinicId') clinicId: string) {
        return this.treatmentsService.seedDefaultTreatments(new Types.ObjectId(clinicId));
    }
}
