import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, randomInt } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Model, Types } from 'mongoose';
import { toDataURL } from 'qrcode';
import { Role } from 'src/common/decorators';
import { errorBody, newTotpSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from 'src/common/utils';
import { jwtConfig } from 'src/config';
import { User, UserDocument } from './auth.schema';

type Id = Types.ObjectId | string;
const SEAL = 'two-factor';
const ISSUER = 'DentFlow';
const BACKUP_CODES = 10;
const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const TRUST_DAYS = 30;
const MAX_TRUSTED = 10;
const CHALLENGE_MINUTES = 10;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const oid = (id: Id) => new Types.ObjectId(id.toString());
/** Backup codes are typed loosely: case, spaces and dashes don't matter. */
const normalizeBackup = (code: string) => code.toLowerCase().replace(/[\s-]/g, '');

export interface Challenge {
    userId: string;
    /** The person must first set up an authenticator (required for their role, not done yet). */
    setup: boolean;
}

/**
 * Two-factor sign-in with an authenticator app (F9): setup with a QR code,
 * one-time codes (each accepted once), 10 backup codes, devices trusted for
 * 30 days. Required for the roles in TWO_FACTOR_REQUIRED_ROLES (default:
 * clinic and super admins; `none` turns the requirement off).
 */
@Injectable()
export class TwoFactorService {
    constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

    required(role: string): boolean {
        const setting = process.env.TWO_FACTOR_REQUIRED_ROLES ?? `${Role.SUPER_ADMIN},${Role.CLINIC_ADMIN}`;
        if (setting.trim() === 'none') return false;
        return setting.split(',').map((r) => r.trim()).includes(role);
    }

    async status(userId: Id, role: string) {
        const user = await this.userModel.findById(oid(userId)).select('twoFactorEnabledAt +backupCodeHashes +trustedDevices').lean();
        return {
            enabled: !!user?.twoFactorEnabledAt,
            enabledAt: user?.twoFactorEnabledAt ?? null,
            required: this.required(role),
            backupCodesLeft: user?.backupCodeHashes?.length ?? 0,
            trustedDevices: (user?.trustedDevices ?? []).filter((d) => d.expiresAt > new Date()).length,
        };
    }

    /**
     * A secret to scan; it only takes effect once a code from it is confirmed.
     * Asking again (a reload, a double request) shows the same unconfirmed
     * secret, so the QR on screen always matches the one that will be checked.
     */
    async beginSetup(userId: Id) {
        const user = await this.userModel.findById(oid(userId)).select('email twoFactorEnabledAt +twoFactorPendingSealed').lean();
        if (!user) throw new UnauthorizedException(errorBody('unauthorized', 'User not found'));
        if (user.twoFactorEnabledAt) throw new BadRequestException(errorBody('twoFactorAlreadyOn', 'Two-factor sign-in is already on'));
        let secret = openSecret(user.twoFactorPendingSealed, SEAL);
        if (!secret) {
            // Only the first of two simultaneous requests stores its secret; the other uses it.
            await this.userModel.updateOne(
                { _id: user._id, twoFactorPendingSealed: null },
                { $set: { twoFactorPendingSealed: sealSecret(newTotpSecret(), SEAL) } },
            );
            const stored = await this.userModel.findById(user._id).select('+twoFactorPendingSealed').lean();
            secret = openSecret(stored?.twoFactorPendingSealed, SEAL);
        }
        if (!secret) throw new BadRequestException(errorBody('twoFactorNoSetup', 'Start the setup again'));
        const url = otpauthUrl(ISSUER, user.email, secret);
        return { secret, otpauthUrl: url, qr: await toDataURL(url, { margin: 1, width: 220 }) };
    }

    /** The first code from the app switches it on; the backup codes are shown this once. */
    async confirmSetup(userId: Id, code: string) {
        const user = await this.userModel.findById(oid(userId)).select('+twoFactorPendingSealed twoFactorEnabledAt').lean();
        const secret = openSecret(user?.twoFactorPendingSealed, SEAL);
        if (!user || !secret) throw new BadRequestException(errorBody('twoFactorNoSetup', 'Start the setup again'));
        const step = verifyTotp(secret, code);
        if (step === null) throw new BadRequestException(errorBody('twoFactorCodeInvalid', 'That code is not right'));
        const codes = this.newBackupCodes();
        await this.userModel.updateOne(
            { _id: user._id },
            {
                $set: {
                    twoFactorSecretSealed: sealSecret(secret, SEAL),
                    twoFactorEnabledAt: new Date(),
                    twoFactorLastStep: step,
                    backupCodeHashes: codes.map((c) => sha256(normalizeBackup(c))),
                },
                $unset: { twoFactorPendingSealed: '' },
            },
        );
        return { backupCodes: codes };
    }

    async disable(userId: Id, role: string, code: string) {
        if (this.required(role)) {
            throw new BadRequestException(errorBody('twoFactorRequired', 'Two-factor sign-in is required for your role'));
        }
        if (!(await this.verify(userId, code))) throw this.badCode();
        await this.clear(userId);
        return { enabled: false };
    }

    async regenerateBackupCodes(userId: Id, code: string) {
        if (!(await this.verify(userId, code))) throw this.badCode();
        const codes = this.newBackupCodes();
        await this.userModel.updateOne({ _id: oid(userId) }, { $set: { backupCodeHashes: codes.map((c) => sha256(normalizeBackup(c))) } });
        return { backupCodes: codes };
    }

    /**
     * An app code (each time step once, so a code seen over someone's
     * shoulder is already spent) or an unused backup code (then gone).
     */
    async verify(userId: Id, code: string): Promise<boolean> {
        const user = await this.userModel.findById(oid(userId)).select('+twoFactorSecretSealed twoFactorEnabledAt').lean();
        const secret = openSecret(user?.twoFactorSecretSealed, SEAL);
        if (!user?.twoFactorEnabledAt || !secret) return false;

        const step = verifyTotp(secret, code);
        if (step !== null) {
            const used = await this.userModel.updateOne(
                { _id: user._id, $or: [{ twoFactorLastStep: { $lt: step } }, { twoFactorLastStep: null }] },
                { $set: { twoFactorLastStep: step } },
            );
            return used.modifiedCount === 1;
        }
        const hash = sha256(normalizeBackup(String(code ?? '')));
        const spent = await this.userModel.updateOne({ _id: user._id, backupCodeHashes: hash }, { $pull: { backupCodeHashes: hash } });
        return spent.modifiedCount === 1;
    }

    /** Off, with its secret, backup codes and trusted devices (lost phone: an admin resets it). */
    async clear(userId: Id) {
        await this.userModel.updateOne(
            { _id: oid(userId) },
            {
                $unset: {
                    twoFactorSecretSealed: '',
                    twoFactorPendingSealed: '',
                    twoFactorEnabledAt: '',
                    twoFactorLastStep: '',
                    backupCodeHashes: '',
                    trustedDevices: '',
                },
            },
        );
    }

    // ── Sign-in ──────────────────────────────────────────────────────────

    /** What a correct password still needs: a code, setting up an app first, or nothing. */
    async gate(user: Pick<UserDocument, '_id' | 'role' | 'twoFactorEnabledAt'>, trustedDevice?: string): Promise<'code' | 'setup' | null> {
        if (user.twoFactorEnabledAt) return (await this.isTrusted(user._id, trustedDevice)) ? null : 'code';
        return this.required(user.role) ? 'setup' : null;
    }

    /** A short-lived ticket between the password step and the code step. */
    challenge(userId: Id, setup: boolean): string {
        return jwt.sign({ userId: userId.toString(), setup, purpose: 'two-factor' }, jwtConfig.accessSecret, { expiresIn: `${CHALLENGE_MINUTES}m` });
    }

    readChallenge(token: string): Challenge {
        try {
            const payload = jwt.verify(token, jwtConfig.accessSecret) as jwt.JwtPayload;
            if (payload.purpose !== 'two-factor' || !payload.userId) throw new Error('wrong token');
            return { userId: String(payload.userId), setup: !!payload.setup };
        } catch {
            throw new UnauthorizedException(errorBody('twoFactorChallengeExpired', 'Sign in again'));
        }
    }

    /** Remember this browser for 30 days; the token lives only in it, its hash here. */
    async trust(userId: Id, userAgent?: string): Promise<string> {
        const token = randomBytes(32).toString('base64url');
        const now = new Date();
        await this.userModel.updateOne(
            { _id: oid(userId) },
            {
                $push: {
                    trustedDevices: {
                        $each: [{ tokenHash: sha256(token), expiresAt: new Date(now.getTime() + TRUST_DAYS * 86_400_000), createdAt: now, userAgent: userAgent?.slice(0, 300) }],
                        $slice: -MAX_TRUSTED,
                    },
                },
            },
        );
        return token;
    }

    async forgetTrustedDevices(userId: Id) {
        await this.userModel.updateOne({ _id: oid(userId) }, { $unset: { trustedDevices: '' } });
    }

    private async isTrusted(userId: Id, token?: string): Promise<boolean> {
        if (!token) return false;
        return !!(await this.userModel.exists({
            _id: oid(userId),
            trustedDevices: { $elemMatch: { tokenHash: sha256(token), expiresAt: { $gt: new Date() } } },
        }));
    }

    private newBackupCodes(): string[] {
        return Array.from({ length: BACKUP_CODES }, () => {
            const chars = Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join('');
            return `${chars.slice(0, 5)}-${chars.slice(5)}`;
        });
    }

    private badCode() {
        return new BadRequestException(errorBody('twoFactorCodeInvalid', 'That code is not right'));
    }
}
