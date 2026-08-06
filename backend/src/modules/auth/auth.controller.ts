import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public, CurrentUser } from 'src/common/decorators';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, TokenResponseDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    @ApiOperation({ summary: 'Register a new clinic and admin user' })
    @ApiResponse({ status: 201, description: 'Clinic created, tokens returned', type: TokenResponseDto })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Authenticate with email and password' })
    @ApiResponse({ status: 200, description: 'Login successful, tokens returned', type: TokenResponseDto })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token using a valid refresh token' })
    @ApiResponse({ status: 200, description: 'New token pair returned', type: TokenResponseDto })
    @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
    async refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshToken(dto.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Log out the current user (clears refresh token)' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@CurrentUser('userId') userId: string) {
        return this.authService.logout(userId);
    }

    @Get('me')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    @ApiResponse({ status: 200, description: 'User profile returned' })
    async getMe(@CurrentUser('userId') userId: string) {
        return this.authService.getMe(userId);
    }
}
