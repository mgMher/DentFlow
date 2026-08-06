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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @ApiOperation({ summary: 'List all users in the current clinic' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiResponse({ status: 200, description: 'Paginated list of users' })
    async findAll(
        @CurrentUser('clinicId') clinicId: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('search') search?: string,
    ) {
        return this.usersService.findAll(clinicId, { page, limit, search });
    }

    @Get('dentists')
    @ApiOperation({ summary: 'List all dentists in the current clinic' })
    @ApiResponse({ status: 200, description: 'List of dentists' })
    async findDentists(@CurrentUser('clinicId') clinicId: string) {
        return this.usersService.findDentists(clinicId);
    }

    @Post()
    @Roles(Role.CLINIC_ADMIN)
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
    @Roles(Role.CLINIC_ADMIN)
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

    @Delete(':id')
    @Roles(Role.CLINIC_ADMIN)
    @ApiOperation({ summary: 'Deactivate a user (soft delete)' })
    @ApiResponse({ status: 200, description: 'User deactivated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async deactivate(
        @CurrentUser('clinicId') clinicId: string,
        @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    ) {
        return this.usersService.deactivate(clinicId, id.toString());
    }
}
