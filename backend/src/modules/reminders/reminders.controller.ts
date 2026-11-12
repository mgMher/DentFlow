import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Role, Roles } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { errorBody } from 'src/common/utils';
import { RemindersService } from './reminders.service';
import { PatientRemindersDto, TestReminderDto, UpdateReminderSettingsDto } from './dto/reminders.dto';

const ADMINS = [Role.SUPER_ADMIN, Role.CLINIC_ADMIN];
/** Who may link a patient's Telegram or turn their reminders off — the patient editors. */
const PATIENT_EDITORS = [...ADMINS, Role.DENTIST, Role.RECEPTIONIST];

@ApiTags('Reminders')
@ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
    constructor(private readonly reminders: RemindersService) {}

    @Get('settings')
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Reminder settings (secrets shown only as set / not set)' })
    getSettings(@CurrentUser('clinicId') clinicId: string) {
        return this.reminders.getSettings(clinicId);
    }

    @Put('settings')
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Change reminder settings; a new bot token is checked with Telegram' })
    updateSettings(@CurrentUser('clinicId') clinicId: string, @Body() dto: UpdateReminderSettingsDto) {
        return this.reminders.updateSettings(clinicId, dto);
    }

    @Post('test')
    @HttpCode(200)
    @Roles(...ADMINS)
    @ApiOperation({ summary: 'Send a test message to a patient through one channel' })
    test(@CurrentUser('clinicId') clinicId: string, @Body() dto: TestReminderDto) {
        return this.reminders.test(clinicId, dto);
    }

    @Get('log')
    @Roles(...ADMINS, Role.RECEPTIONIST)
    @ApiOperation({ summary: 'The last 100 reminders' })
    log(@CurrentUser('clinicId') clinicId: string) {
        return this.reminders.recentLog(clinicId);
    }

    @Get('appointments/:appointmentId')
    @ApiOperation({ summary: 'Reminders sent for one appointment' })
    appointmentLog(
        @CurrentUser('clinicId') clinicId: string,
        @Param('appointmentId', ParseObjectIdPipe) appointmentId: string,
    ) {
        return this.reminders.logForAppointment(clinicId, appointmentId);
    }

    @Get('patients/:patientId')
    @ApiOperation({ summary: "A patient's reminder status: Telegram linked, opted out, channels available" })
    patient(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: string) {
        return this.reminders.patientStatus(clinicId, String(patientId));
    }

    @Patch('patients/:patientId')
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'Turn reminders off or on for a patient' })
    setOptOut(
        @CurrentUser('clinicId') clinicId: string,
        @Param('patientId', ParseObjectIdPipe) patientId: string,
        @Body() dto: PatientRemindersDto,
    ) {
        return this.reminders.setOptOut(clinicId, String(patientId), dto);
    }

    @Post('patients/:patientId/telegram-link')
    @HttpCode(200)
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'A one-time Telegram link for the patient (valid 30 days)' })
    telegramLink(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: string) {
        return this.reminders.telegramLink(clinicId, String(patientId));
    }

    @Post('patients/:patientId/telegram-link/sms')
    @HttpCode(200)
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: 'Text the patient their Telegram link' })
    telegramLinkSms(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: string) {
        return this.reminders.sendTelegramLinkBySms(clinicId, String(patientId));
    }

    @Delete('patients/:patientId/telegram')
    @Roles(...PATIENT_EDITORS)
    @ApiOperation({ summary: "Unlink the patient's Telegram" })
    unlink(@CurrentUser('clinicId') clinicId: string, @Param('patientId', ParseObjectIdPipe) patientId: string) {
        return this.reminders.unlinkTelegram(clinicId, String(patientId));
    }
}

/** Telegram calls this for every message and button press to a clinic's bot. */
@Controller('telegram')
export class TelegramWebhookController {
    constructor(private readonly reminders: RemindersService) {}

    @Public()
    @Post('webhook/:clinicId')
    @HttpCode(200)
    @ApiExcludeEndpoint()
    async webhook(
        @Param('clinicId') clinicId: string,
        @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
        @Body() update: unknown,
    ) {
        if (!(await this.reminders.webhookSecretMatches(clinicId, secret))) {
            throw new ForbiddenException(errorBody('forbidden', 'Unknown webhook'));
        }
        // Answer at once; Telegram retries slow or failed calls.
        void this.reminders.handleUpdate(clinicId, update);
        return { ok: true };
    }
}
