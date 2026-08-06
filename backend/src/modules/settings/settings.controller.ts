import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, Role } from 'src/common/decorators';
import { SettingsService } from './settings.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@Roles(Role.CLINIC_ADMIN)
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) {}

    @Get('templates')
    @ApiOperation({ summary: 'List all notification templates' })
    getTemplates(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
    ) {
        return this.settingsService.getTemplates(user.clinicId);
    }

    @Post('templates')
    @ApiOperation({ summary: 'Create a notification template' })
    createTemplate(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Body() dto: CreateTemplateDto,
    ) {
        return this.settingsService.createTemplate(user.clinicId, dto);
    }

    @Patch('templates/:id')
    @ApiOperation({ summary: 'Update a notification template' })
    updateTemplate(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
        @Body() dto: UpdateTemplateDto,
    ) {
        return this.settingsService.updateTemplate(user.clinicId, id, dto);
    }

    @Delete('templates/:id')
    @ApiOperation({ summary: 'Delete a notification template' })
    deleteTemplate(
        @CurrentUser() user: { userId: string; clinicId: string; email: string; role: string },
        @Param('id') id: string,
    ) {
        return this.settingsService.deleteTemplate(user.clinicId, id);
    }
}
