import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { Public, CurrentUser } from 'src/common/decorators';
import { AuthService } from './auth.service';
import { SessionMeta } from './sessions.service';
import { ChangePasswordDto, RegisterDto, LoginDto, RefreshTokenDto, TokenResponseDto } from './dto';

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
    constructor(private readonly authService: AuthService) {}

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

    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    async getMe(@CurrentUser('userId') userId: string) {
        return this.authService.getMe(userId);
    }
}
