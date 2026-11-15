import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { Public, CurrentUser } from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes';
import { errorBody } from 'src/common/utils';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { SessionMeta, SessionsService } from './sessions.service';
import {
    ChangePasswordDto,
    ForgotPasswordDto,
    LoginDto,
    RefreshTokenDto,
    RegisterDto,
    ResetPasswordWithTokenDto,
    TokenResponseDto,
    TwoFactorChallengeDto,
    TwoFactorCodeDto,
    TwoFactorLoginDto,
} from './dto';

const metaOf = (req: Request): SessionMeta => ({
    userAgent: req.headers['user-agent'],
    ip: req.ip,
});

/**
 * Per-IP limits on the unauthenticated routes. Login also has a per-account
 * lockout (AuthService), which is what actually stops password guessing; this
 * stops one address from hammering many accounts. A whole clinic usually
 * shares one IP, so the login limit stays generous.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly twoFactor: TwoFactorService,
        private readonly sessions: SessionsService,
    ) {}

    @Public()
    @Post('register')
    @UseGuards(ThrottlerGuard)
    @Throttle(5, 3600)
    @ApiOperation({ summary: 'Register a new clinic and admin user' })
    @ApiResponse({ status: 201, description: 'Clinic created, tokens returned', type: TokenResponseDto })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async register(@Body() dto: RegisterDto, @Req() req: Request) {
        return this.authService.register(dto, metaOf(req));
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(30, 60)
    @ApiOperation({ summary: 'Authenticate with email and password' })
    @ApiResponse({ status: 200, description: 'Login successful, tokens returned', type: TokenResponseDto })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    @ApiResponse({ status: 429, description: 'Account locked or too many requests' })
    async login(@Body() dto: LoginDto, @Req() req: Request) {
        return this.authService.login(dto, metaOf(req));
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(60, 60)
    @ApiOperation({ summary: 'Rotate the refresh token and get a new access token' })
    @ApiResponse({ status: 200, description: 'New token pair returned', type: TokenResponseDto })
    @ApiResponse({ status: 401, description: 'Invalid, expired or revoked session' })
    async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
        return this.authService.refreshToken(dto.refreshToken, metaOf(req));
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Sign out this device' })
    async logout(@CurrentUser('sessionId') sessionId: string) {
        return this.authService.logout(sessionId);
    }

    @Post('logout-all')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Sign out every device' })
    async logoutAll(@CurrentUser('userId') userId: string) {
        return this.authService.logoutAll(userId);
    }

    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(10, 600)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change your own password (signs out your other devices)' })
    @ApiResponse({ status: 400, description: 'Current password is wrong, or new password is invalid' })
    async changePassword(
        @CurrentUser('userId') userId: string,
        @CurrentUser('sessionId') sessionId: string,
        @Body() dto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(userId, sessionId, dto);
    }

    // ── F9: two-factor sign-in, step two ─────────────────────────────────

    @Public()
    @Post('login/2fa')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(30, 60)
    @ApiOperation({ summary: 'Finish signing in with an authenticator or backup code' })
    async loginTwoFactor(@Body() dto: TwoFactorLoginDto, @Req() req: Request) {
        return this.authService.loginWithCode(dto, metaOf(req));
    }

    @Public()
    @Post('login/2fa/setup')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(10, 60)
    @ApiOperation({ summary: 'Two-factor is required but not set up: get a secret / QR code to scan' })
    async loginTwoFactorSetup(@Body() dto: TwoFactorChallengeDto) {
        return this.authService.loginSetup(dto);
    }

    @Public()
    @Post('login/2fa/enable')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(30, 60)
    @ApiOperation({ summary: 'Confirm the first code, switch two-factor on and finish signing in (returns backup codes once)' })
    async loginTwoFactorEnable(@Body() dto: TwoFactorLoginDto, @Req() req: Request) {
        return this.authService.loginEnable(dto, metaOf(req));
    }

    // ── F9: password reset by email ───────────────────────────────────────

    @Public()
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(5, 600)
    @ApiOperation({ summary: 'Email a one-time reset link (same answer whether or not the email has an account)' })
    async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
        return this.authService.forgotPassword(dto, metaOf(req));
    }

    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(10, 600)
    @ApiOperation({ summary: 'Set a new password with the emailed link; signs out every device' })
    async resetPassword(@Body() dto: ResetPasswordWithTokenDto, @Req() req: Request) {
        return this.authService.resetPassword(dto, metaOf(req));
    }

    // ── F9: my two-factor and devices ─────────────────────────────────────

    @Get('2fa')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'My two-factor status' })
    twoFactorStatus(@CurrentUser('userId') userId: string, @CurrentUser('role') role: string) {
        return this.twoFactor.status(userId, role);
    }

    @Post('2fa/setup')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Start setting up an authenticator app' })
    setupTwoFactor(@CurrentUser('userId') userId: string) {
        return this.twoFactor.beginSetup(userId);
    }

    @Post('2fa/enable')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(10, 60)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Confirm the first code; returns the backup codes once' })
    enableTwoFactor(@CurrentUser('userId') userId: string, @Body() dto: TwoFactorCodeDto) {
        return this.twoFactor.confirmSetup(userId, dto.code);
    }

    @Post('2fa/disable')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(10, 60)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Turn two-factor off (not for roles that require it)' })
    disableTwoFactor(@CurrentUser('userId') userId: string, @CurrentUser('role') role: string, @Body() dto: TwoFactorCodeDto) {
        return this.twoFactor.disable(userId, role, dto.code);
    }

    @Post('2fa/backup-codes')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle(10, 60)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'New backup codes (the old ones stop working)' })
    regenerateBackupCodes(@CurrentUser('userId') userId: string, @Body() dto: TwoFactorCodeDto) {
        return this.twoFactor.regenerateBackupCodes(userId, dto.code);
    }

    @Get('sessions')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'My signed-in devices' })
    listSessions(@CurrentUser('userId') userId: string, @CurrentUser('sessionId') sessionId: string) {
        return this.sessions.list(userId, sessionId);
    }

    @Delete('sessions/:id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Sign out one of my devices' })
    async revokeSession(@CurrentUser('userId') userId: string, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
        if (!(await this.sessions.revokeOwn(userId, id))) {
            throw new NotFoundException(errorBody('sessionNotFound', 'That device is already signed out'));
        }
        return { revoked: true };
    }

    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    async getMe(@CurrentUser('userId') userId: string) {
        return this.authService.getMe(userId);
    }
}
