import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { jwtConfig } from 'src/config';
import { Role } from 'src/common/decorators';
import { User, UserDocument } from './auth.schema';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    ) {}

    /**
     * Register a new clinic with its first admin user.
     * Creates both the Clinic document and an associated User with role clinic_admin.
     */
    async register(dto: RegisterDto) {
        const existingUser = await this.userModel.findOne({ email: dto.email.toLowerCase() });

        if (existingUser) {
            throw new ConflictException('A user with this email already exists');
        }

        const clinic = await this.clinicModel.create({
            name: dto.clinicName,
            phone: dto.phone || '',
        });

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        const user = await this.userModel.create({
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            clinicId: clinic._id,
            role: Role.CLINIC_ADMIN,
            firstName: dto.firstName,
            lastName: dto.lastName,
        });

        const tokens = this.generateTokens(
            user._id.toString(),
            clinic._id.toString(),
            user.email,
            user.role,
        );

        await this.userModel.findByIdAndUpdate(user._id, {
            refreshToken: tokens.refreshToken,
        });

        return {
            ...tokens,
            user: this.sanitizeUser(user),
        };
    }

    /**
     * Authenticate a user with email + password.
     * Updates lastLogin timestamp and stores the new refresh token.
     */
    async login(dto: LoginDto) {
        const user = await this.userModel.findOne({
            email: dto.email.toLowerCase(),
        });

        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const tokens = this.generateTokens(
            user._id.toString(),
            user.clinicId.toString(),
            user.email,
            user.role,
        );

        await this.userModel.findByIdAndUpdate(user._id, {
            lastLogin: new Date(),
            refreshToken: tokens.refreshToken,
        });

        return {
            ...tokens,
            user: this.sanitizeUser(user),
        };
    }

    /**
     * Validate a refresh token and issue a new access + refresh token pair.
     * The old refresh token is replaced with the new one (rotation).
     */
    async refreshToken(refreshToken: string) {
        if (!refreshToken) {
            throw new BadRequestException('Refresh token is required');
        }

        let payload: any;
        try {
            payload = jwt.verify(refreshToken, jwtConfig.refreshSecret);
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.userModel.findById(payload.userId);

        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not found or deactivated');
        }

        if (user.refreshToken !== refreshToken) {
            // Potential token reuse detected -- clear all refresh tokens for safety
            await this.userModel.findByIdAndUpdate(user._id, { refreshToken: null });
            throw new UnauthorizedException('Refresh token has been revoked');
        }

        const tokens = this.generateTokens(
            user._id.toString(),
            user.clinicId.toString(),
            user.email,
            user.role,
        );

        await this.userModel.findByIdAndUpdate(user._id, {
            refreshToken: tokens.refreshToken,
        });

        return {
            ...tokens,
            user: this.sanitizeUser(user),
        };
    }

    /**
     * Log out a user by clearing their stored refresh token.
     */
    async logout(userId: string) {
        await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
        return { message: 'Logged out successfully' };
    }

    /**
     * Retrieve the current user's profile by ID.
     * Populates the clinicId reference for convenience.
     */
    async getMe(userId: string) {
        const user = await this.userModel
            .findById(userId)
            .select('-password -refreshToken')
            .populate('clinicId', 'name phone address city country')
            .lean();

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return user;
    }

    /**
     * Generate a JWT access + refresh token pair.
     */
    generateTokens(userId: string, clinicId: string, email: string, role: string) {
        const accessToken = jwt.sign(
            { userId, clinicId, email, role },
            jwtConfig.accessSecret,
            { expiresIn: jwtConfig.accessExpiration as jwt.SignOptions['expiresIn'] },
        );

        const refreshToken = jwt.sign(
            { userId, clinicId },
            jwtConfig.refreshSecret,
            { expiresIn: jwtConfig.refreshExpiration as jwt.SignOptions['expiresIn'] },
        );

        return { accessToken, refreshToken };
    }

    /**
     * Strip sensitive fields before returning a user object in responses.
     */
    private sanitizeUser(user: UserDocument) {
        return {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            clinicId: user.clinicId,
        };
    }
}
