import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import {
    CreateUserDto,
    QueryUserDto,
    UpdateAvailabilityDto,
    UpdateUserDto,
    UpdateUserStatusDto,
} from './dto';

/** Everyone who is allowed to manage the clinic's staff records. */
const STAFF_MANAGERS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN] as const;

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @ApiOperation({ summary: 'List staff in the current clinic' })
    @ApiResponse({ status: 200, description: 'Paginated list of users' })
    async findAll(
        @CurrentUser('clinicId') clinicId: string,
        @Query() query: QueryUserDto,
    ) {
        return this.usersService.findAll(clinicId, query);
    }

    @Get('dentists')
    @ApiOperation({ summary: 'List all dentists in the current clinic' })
    @ApiResponse({ status: 200, description: 'List of dentists' })
    async findDentists(@CurrentUser('clinicId') clinicId: string) {
        return this.usersService.findDentists(clinicId);
    }

    @Post()
    @Roles(...STAFF_MANAGERS)
    @ApiOperation({ summary: 'Create a new user in the current clinic' })
    @ApiResponse({ status: 201, description: 'User created' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async create(
        @CurrentUser('clinicId') clinicId: string,
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.create(clinicId, dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a user by ID' })
    @ApiResponse({ status: 200, description: 'User returned' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async findById(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.usersService.findById(clinicId, id.toString());
    }

    @Patch(':id')
    @Roles(...STAFF_MANAGERS)
    @ApiOperation({ summary: 'Update a user by ID' })
    @ApiResponse({ status: 200, description: 'User updated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async update(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateUserDto,
    ) {
        return this.usersService.update(clinicId, id.toString(), dto);
    }

    @Patch(':id/status')
    @Roles(...STAFF_MANAGERS)
    @ApiOperation({ summary: 'Activate or deactivate a user' })
    @ApiResponse({ status: 200, description: 'Status updated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async setStatus(
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') actingAuthId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateUserStatusDto,
    ) {
        return this.usersService.setActive(clinicId, id.toString(), dto.isActive, actingAuthId);
    }

    /**
     * Availability is the member's own working hours, so a dentist or assistant
     * may maintain their own even though they cannot edit staff records.
     */
    @Patch(':id/availability')
    @Roles(Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DENTIST, Role.ASSISTANT)
    @ApiOperation({ summary: 'Replace a user’s weekly availability' })
    @ApiResponse({ status: 200, description: 'Availability updated' })
    @ApiResponse({ status: 403, description: 'Cannot edit another member’s availability' })
    async updateAvailability(
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') actingAuthId: string,
        @CurrentUser('role') actingRole: Role,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
        @Body() dto: UpdateAvailabilityDto,
    ) {
        if (!STAFF_MANAGERS.includes(actingRole as (typeof STAFF_MANAGERS)[number])) {
            const own = await this.usersService.findByAuthId(clinicId, actingAuthId);
            if (!own || own._id.toString() !== id.toString()) {
                throw new ForbiddenException({
                    code: 'notOwnAvailability',
                    message: 'You can only edit your own availability',
                });
            }
        }

        return this.usersService.updateAvailability(clinicId, id.toString(), dto);
    }

    @Delete(':id')
    @Roles(...STAFF_MANAGERS)
    @ApiOperation({ summary: 'Deactivate a user (soft delete)' })
    @ApiResponse({ status: 200, description: 'User deactivated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async deactivate(
        @CurrentUser('clinicId') clinicId: string,
        @CurrentUser('userId') actingAuthId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.usersService.deactivate(clinicId, id.toString(), actingAuthId);
    }
}
