import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    OnModuleInit,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { runOnce } from 'src/common/migrations/run-once';
import * as bcrypt from 'bcryptjs';
import { Role } from 'src/common/decorators';
import { errorBody } from 'src/common/utils';
import { User, UserDocument } from './auth.schema';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import { UserProfile, UserProfileDocument } from '../users/user.schema';
import { TreatmentsService } from '../treatments/treatments.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordWithTokenDto, TwoFactorChallengeDto, TwoFactorLoginDto } from './dto';
import { SessionMeta, SessionsService } from './sessions.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from 'src/common/mail/mail.service';
import { TwoFactorService } from './two-factor.service';
import { resetEmail } from './reset-email';
import { createHash, randomBytes } from 'crypto';

export const PASSWORD_HASH_COST = 12;

/** After this many wrong passwords in a row the account is locked for LOCK_MINUTES. */
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

const emailTaken = () =>
    new ConflictException(errorBody('accountEmailTaken', 'A user with this email already exists'));

/** F9: how long an emailed reset link works. */
const RESET_MINUTES = 60;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
        @InjectModel(UserProfile.name) private readonly profileModel: Model<UserProfileDocument>,
        private readonly sessions: SessionsService,
        private readonly treatmentsService: TreatmentsService,
        @InjectConnection() private readonly connection: Connection,
        private readonly audit: AuditService,
        private readonly twoFactor: TwoFactorService,
        private readonly mail: MailService,
    ) {}

    /**
     * Two one-off repairs, both idempotent:
     * - Registration never created a staff profile for the founding admin, so
     *   they were missing from the staff list and from the "last admin" guard.
     * - Refresh tokens moved to hashed per-device sessions; drop the old
     *   plaintext copies from user documents.
     */
    async onModuleInit(): Promise<void> {
        await runOnce(this.connection, '2026-10-founder-profile-backfill', this.logger, async () => {
            const orphans = await this.userModel.aggregate<UserDocument>([
                { $lookup: { from: 'user_profiles', localField: '_id', foreignField: 'authId', as: 'profile' } },
                { $match: { profile: { $size: 0 } } },
                { $project: { profile: 0 } },
            ]);
            if (orphans.length) {
                await this.profileModel.insertMany(orphans.map((u) => this.profileFor(u)), { ordered: false });
                this.logger.log(`Created staff profiles for ${orphans.length} account(s) that had none`);
            }
            return orphans.length;
        });

        await runOnce(this.connection, '2026-10-drop-plaintext-refresh-tokens', this.logger, async () => {
            const cleared = await this.userModel.updateMany(
                { refreshToken: { $exists: true } },
                { $unset: { refreshToken: 1 } },
                { strict: false },
            );
            if (cleared.modifiedCount) {
                this.logger.log(`Removed legacy plaintext refresh tokens from ${cleared.modifiedCount} user(s)`);
            }
            return cleared.modifiedCount;
        });
    }

    /**
     * Register a clinic with its first admin.
     *
     * Creates the clinic, the admin's login and staff profile, and the default
     * treatment catalogue. There is no transaction (it would need a replica
     * set), so a failure part-way removes what was already written — before,
     * a failure left an orphan clinic or permanently blocked the email.
     */
    async register(dto: RegisterDto, meta: SessionMeta) {
        const email = dto.email.toLowerCase();

        if (await this.userModel.exists({ email })) {
            throw emailTaken();
        }

        const clinic = await this.clinicModel.create({
            name: dto.clinicName,
            phone: dto.phone || '',
            email,
        });

        let user: UserDocument | undefined;
        try {
            user = await this.userModel.create({
                email,
                password: await bcrypt.hash(dto.password, PASSWORD_HASH_COST),
                clinicId: clinic._id,
                role: Role.CLINIC_ADMIN,
                firstName: dto.firstName,
                lastName: dto.lastName,
            });
            await this.profileModel.create({ ...this.profileFor(user), phone: dto.phone || '' });
        } catch (err) {
            await Promise.all([
                this.clinicModel.deleteOne({ _id: clinic._id }),
                user && this.userModel.deleteOne({ _id: user._id }),
                this.profileModel.deleteMany({ clinicId: clinic._id }),
            ]);
            if (isDuplicateKey(err)) throw emailTaken();
            throw err;
        }

        // A new clinic with an empty catalogue can't record or bill anything.
        // Not fatal: the admin can still add treatments by hand.
        try {
            await this.treatmentsService.seedDefaultTreatments(clinic._id);
        } catch (err) {
            this.logger.warn(`Could not seed treatments for clinic ${clinic._id}: ${(err as Error).message}`);
        }

        const tokens = await this.sessions.start(user, meta);
        await this.auditSignIn('auth.register', user, meta);
        return { ...tokens, user: this.sanitizeUser(user) };
    }

    async login(dto: LoginDto, meta: SessionMeta) {
        const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });

        if (user?.lockedUntil && user.lockedUntil > new Date()) {
            await this.auditSignIn('auth.loginFailed', user, meta, { reason: 'locked' });
            throw this.lockedError(user.lockedUntil);
        }

        // Same answer for "no such user" and "wrong password", and the password
        // is checked before the active flag, so the response never reveals
        // whether an email has an account.
        const isPasswordValid = !!user?.password && (await bcrypt.compare(dto.password, user.password));

        if (!user || !isPasswordValid) {
            // An unknown email belongs to no clinic, so there is no clinic log to put it in.
            if (user) {
                await this.recordFailedLogin(user._id);
                await this.auditSignIn('auth.loginFailed', user, meta, { reason: 'wrongPassword' });
            }
            throw new UnauthorizedException(errorBody('invalidCredentials', 'Invalid email or password'));
        }

        if (!user.isActive) {
            await this.auditSignIn('auth.loginFailed', user, meta, { reason: 'deactivated' });
            throw new UnauthorizedException(errorBody('accountDeactivated', 'Account is deactivated'));
        }

        // F9: a correct password may still need an authenticator code, or setting one up.
        const next = await this.twoFactor.gate(user, dto.trustedDevice);
        if (next) {
            return {
                twoFactorRequired: next === 'code',
                twoFactorSetupRequired: next === 'setup',
                challenge: this.twoFactor.challenge(user._id, next === 'setup'),
            };
        }
        return this.completeLogin(user, meta);
    }

    /** Step two: the code from the authenticator app, or a backup code. */
    async loginWithCode(dto: TwoFactorLoginDto, meta: SessionMeta) {
        const user = await this.challengeUser(dto.challenge, false);
        if (!(await this.twoFactor.verify(user._id, dto.code))) {
            await this.recordFailedLogin(user._id);
            await this.auditSignIn('auth.loginFailed', user, meta, { reason: 'wrongCode' });
            throw new UnauthorizedException(errorBody('twoFactorCodeInvalid', 'That code is not right'));
        }
        const trustedDevice = dto.trustDevice ? await this.twoFactor.trust(user._id, meta.userAgent) : undefined;
        return { ...(await this.completeLogin(user, meta, { twoFactor: true })), ...(trustedDevice ? { trustedDevice } : {}) };
    }

    /** Required but not set up yet (admins): a secret and QR code to scan. */
    async loginSetup(dto: TwoFactorChallengeDto) {
        const user = await this.challengeUser(dto.challenge, true);
        return this.twoFactor.beginSetup(user._id);
    }

    /** The first code switches two-factor on and finishes signing in; backup codes are shown this once. */
    async loginEnable(dto: TwoFactorLoginDto, meta: SessionMeta) {
        const user = await this.challengeUser(dto.challenge, true);
        let backupCodes: string[];
        try {
            ({ backupCodes } = await this.twoFactor.confirmSetup(user._id, dto.code));
        } catch (err) {
            await this.recordFailedLogin(user._id);
            throw err;
        }
        await this.auditSignIn('auth.enableTwoFactor', user, meta);
        const trustedDevice = dto.trustDevice ? await this.twoFactor.trust(user._id, meta.userAgent) : undefined;
        return { ...(await this.completeLogin(user, meta, { twoFactor: true })), backupCodes, ...(trustedDevice ? { trustedDevice } : {}) };
    }

    private async completeLogin(user: UserDocument, meta: SessionMeta, details?: Record<string, unknown>) {
        await this.userModel.updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date(), failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } },
        );
        const tokens = await this.sessions.start(user, meta);
        await this.auditSignIn('auth.login', user, meta, details);
        return { ...tokens, user: this.sanitizeUser(user) };
    }

    /** The account behind a two-factor challenge, still allowed to sign in. */
    private async challengeUser(token: string, setup: boolean) {
        const challenge = this.twoFactor.readChallenge(token);
        if (challenge.setup !== setup) throw new UnauthorizedException(errorBody('twoFactorChallengeExpired', 'Sign in again'));
        const user = await this.userModel.findById(challenge.userId);
        if (!user || !user.isActive) throw new UnauthorizedException(errorBody('twoFactorChallengeExpired', 'Sign in again'));
        if (user.lockedUntil && user.lockedUntil > new Date()) throw this.lockedError(user.lockedUntil);
        return user;
    }

    // ── F9: password reset by email ───────────────────────────────────────

    /**
     * Email a one-time link, valid an hour. The answer never says whether the
     * email has an account; a new request replaces an earlier link.
     */
    async forgotPassword(dto: ForgotPasswordDto, meta: SessionMeta) {
        const user = await this.userModel.findOne({ email: dto.email, isActive: true });
        if (user) {
            const token = randomBytes(32).toString('base64url');
            await this.userModel.updateOne(
                { _id: user._id },
                { $set: { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } },
            );
            const clinic = await this.clinicModel.findById(user.clinicId).select('name language').lean();
            const link = `${(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${token}`;
            const mail = resetEmail(clinic?.language, user.firstName || user.email, clinic?.name ?? 'DentFlow', link, RESET_MINUTES);
            try {
                await this.mail.send({ to: user.email, ...mail });
            } catch (err) {
                this.logger.error(`Reset email to user ${user._id} failed: ${(err as Error).message}`);
            }
            await this.auditSignIn('auth.passwordResetRequested', user, meta);
        }
        return { sent: true };
    }

    /** A new password from the emailed link: once, within the hour; every device is signed out. */
    async resetPassword(dto: ResetPasswordWithTokenDto, meta: SessionMeta) {
        const user = await this.userModel.findOneAndUpdate(
            { resetTokenHash: hashToken(dto.token), resetTokenExpiresAt: { $gt: new Date() }, isActive: true },
            {
                $set: { password: await bcrypt.hash(dto.newPassword, PASSWORD_HASH_COST), failedLoginAttempts: 0 },
                $unset: { resetTokenHash: '', resetTokenExpiresAt: '', lockedUntil: '' },
            },
        );
        if (!user) throw new BadRequestException(errorBody('resetLinkInvalid', 'This link has expired or was already used'));
        await this.sessions.revokeAllForUser(user._id);
        await this.twoFactor.forgetTrustedDevices(user._id);
        await this.auditSignIn('auth.passwordReset', user, meta);
        return { reset: true };
    }

    /** Sign-ins happen before there is a signed-in user, so they are logged here rather than by the audit interceptor. */
    private auditSignIn(event: string, user: UserDocument, meta: SessionMeta, details?: Record<string, unknown>) {
        if (!user.clinicId) return Promise.resolve();
        return this.audit.record({
            clinicId: user.clinicId,
            actor: { kind: 'staff', userId: user._id, name: [user.firstName, user.lastName].filter(Boolean).join(' '), role: user.role },
            event,
            details: { email: user.email, ...details },
            ip: meta.ip,
            userAgent: meta.userAgent,
        });
    }

    /** Rotate the refresh token; role and active status are re-read from the account. */
    async refreshToken(refreshToken: string, meta: SessionMeta) {
        if (!refreshToken) {
            throw new BadRequestException('Refresh token is required');
        }

        let current: UserDocument | null = null;
        const { userId, ...tokens } = await this.sessions.rotate(refreshToken, meta, async (id) => {
            current = await this.userModel.findById(id);
            return current?.isActive ? current : null;
        });

        return { ...tokens, user: current ? this.sanitizeUser(current) : { _id: userId } };
    }

    /** Sign out this device only. */
    async logout(sessionId?: string) {
        if (sessionId) await this.sessions.revoke(sessionId);
        return { message: 'Logged out successfully' };
    }

    /** Sign out every device, including this one. */
    async logoutAll(userId: string) {
        await this.sessions.revokeAllForUser(userId);
        // A lost device should not skip the code next time either (F9).
        await this.twoFactor.forgetTrustedDevices(userId);
        return { message: 'Logged out of all devices' };
    }

    /**
     * Change your own password. Other devices are signed out — if the reason
     * for the change is a leaked password, they are exactly what to cut off.
     */
    async changePassword(userId: string, sessionId: string | undefined, dto: ChangePasswordDto) {
        const user = await this.userModel.findById(userId);
        // 400, not 401: a 401 would make the client try to refresh the session.
        if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
            throw new BadRequestException(errorBody('wrongCurrentPassword', 'Current password is incorrect'));
        }
        if (dto.currentPassword === dto.newPassword) {
            throw new BadRequestException(errorBody('samePassword', 'New password must differ from the current one'));
        }

        await this.userModel.updateOne(
            { _id: user._id },
            { $set: { password: await bcrypt.hash(dto.newPassword, PASSWORD_HASH_COST) } },
        );
        await this.sessions.revokeAllForUser(user._id, sessionId);
        return { message: 'Password changed' };
    }

    async getMe(userId: string) {
        const user = await this.userModel
            .findById(userId)
            .select('-password -failedLoginAttempts -lockedUntil')
            .populate('clinicId', 'name phone address city country')
            .lean();

        if (!user) {
            throw new UnauthorizedException(errorBody('unauthorized', 'User not found'));
        }

        return { ...user, twoFactorEnabled: !!user.twoFactorEnabledAt, twoFactorRequired: this.twoFactor.required(user.role) };
    }

    private async recordFailedLogin(userId: Types.ObjectId): Promise<void> {
        const updated = await this.userModel.findOneAndUpdate(
            { _id: userId },
            { $inc: { failedLoginAttempts: 1 } },
            { new: true },
        );
        if (updated && updated.failedLoginAttempts >= MAX_FAILED_LOGINS) {
            const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
            await this.userModel.updateOne({ _id: userId }, { $set: { lockedUntil, failedLoginAttempts: 0 } });
            this.logger.warn(`Account ${userId} locked until ${lockedUntil.toISOString()} after ${MAX_FAILED_LOGINS} failed logins`);
        }
    }

    private lockedError(until: Date) {
        const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
        return new HttpException(
            { ...errorBody('accountLocked', `Too many failed attempts. Try again in ${minutes} minute(s)`), minutes },
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }

    private profileFor(user: Pick<UserDocument, '_id' | 'clinicId' | 'email' | 'firstName' | 'lastName' | 'patronymic' | 'role' | 'isActive'>) {
        return {
            clinicId: user.clinicId,
            authId: user._id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            patronymic: user.patronymic || '',
            email: user.email,
            role: user.role,
            isActive: user.isActive ?? true,
            schedule: { defaultAvailability: [] },
        };
    }

    /** Strip sensitive fields before returning a user object in responses. */
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
