import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createCipheriv, createDecipheriv, createHash, createSecretKey, randomBytes, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { jwtConfig } from 'src/config';
import { errorBody } from 'src/common/utils';
import { Session, SessionDocument } from './session.schema';

type Id = string | Types.ObjectId;

export interface SessionMeta {
    userAgent?: string;
    ip?: string;
}

export interface TokenSubject {
    // Optional only because Mongoose types `_id` that way; it is always set on a saved user.
    _id?: Id;
    clinicId: Id;
    email: string;
    role: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

/** Two tabs refreshing at once both present the same token; the slower one is not theft. */
const REUSE_GRACE_MS = 30_000;

/** Oldest sessions beyond this are signed out, so a lost device cannot stay signed in forever. */
const MAX_SESSIONS_PER_USER = 10;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Plain Uint8Arrays: this @types/node's Buffer doesn't satisfy TypeScript 5.9's crypto signatures.
const bytes = (b64url: string) => new Uint8Array(Buffer.from(b64url, 'base64url'));
const graceKey = () =>
    createSecretKey(new Uint8Array(createHash('sha256').update(`${jwtConfig.refreshSecret}:grace-token`).digest()));

/** AES-256-GCM, as `iv.tag.ciphertext` in base64url. Anyone holding the key could mint tokens anyway. */
const sealToken = (token: string): string => {
    const iv = randomBytes(12).toString('base64url');
    const cipher = createCipheriv('aes-256-gcm', graceKey(), bytes(iv));
    const data = cipher.update(token, 'utf8', 'base64url') + cipher.final('base64url');
    return [iv, cipher.getAuthTag().toString('base64url'), data].join('.');
};

const openToken = (sealed: string): string | null => {
    try {
        const [iv, tag, data] = sealed.split('.');
        const decipher = createDecipheriv('aes-256-gcm', graceKey(), bytes(iv));
        decipher.setAuthTag(bytes(tag));
        return decipher.update(data, 'base64url', 'utf8') + decipher.final('utf8');
    } catch {
        return null;
    }
};

const expiryOf = (token: string): Date => new Date(((jwt.decode(token) as jwt.JwtPayload).exp ?? 0) * 1000);

const sessionExpired = () =>
    new UnauthorizedException(errorBody('sessionExpired', 'Session has expired, please sign in again'));

/**
 * Refresh-token sessions, one per signed-in device.
 *
 * Replaces the single plaintext `refreshToken` on the user: signing in on a
 * second device used to sign the first one out, and the first device's next
 * refresh then looked like token theft and killed both.
 */
@Injectable()
export class SessionsService {
    constructor(@InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>) {}

    async start(user: TokenSubject, meta: SessionMeta): Promise<TokenPair> {
        const sessionId = new Types.ObjectId();
        const tokens = this.sign(user, sessionId);
        const now = new Date();

        await this.sessionModel.create({
            _id: sessionId,
            userId: user._id,
            clinicId: user.clinicId,
            tokenHash: hashToken(tokens.refreshToken),
            userAgent: meta.userAgent?.slice(0, 300),
            ip: meta.ip,
            lastUsedAt: now,
            expiresAt: expiryOf(tokens.refreshToken),
        });
        await this.pruneOldSessions(user._id!);

        return tokens;
    }

    /**
     * Verify a refresh token and rotate it. Presenting a token that was
     * already rotated away (outside the grace window) means it was copied, so
     * the whole session is revoked.
     *
     * Inside the grace window the previous token gets the token its rotation
     * issued, not a new one: tabs share one stored token, and rotating again
     * for each of them made the chain fork, so the third tab to refresh at
     * once looked like a thief and the session was revoked.
     *
     * `loadUser` re-reads the account so role and active status are current.
     */
    async rotate(
        refreshToken: string,
        meta: SessionMeta,
        loadUser: (userId: string) => Promise<TokenSubject | null>,
        attempt = 0,
    ): Promise<TokenPair & { userId: string }> {
        let payload: jwt.JwtPayload;
        try {
            payload = jwt.verify(refreshToken, jwtConfig.refreshSecret) as jwt.JwtPayload;
        } catch {
            throw sessionExpired();
        }
        if (!payload.sid || !payload.userId) {
            throw sessionExpired();
        }

        const session = await this.sessionModel.findById(payload.sid).lean();
        const now = new Date();
        if (!session || session.revokedAt || session.expiresAt <= now || session.userId.toString() !== payload.userId) {
            throw sessionExpired();
        }

        const presented = hashToken(refreshToken);
        const isCurrent = presented === session.tokenHash;
        const isRecentPrevious =
            presented === session.previousTokenHash &&
            !!session.rotatedAt &&
            now.getTime() - new Date(session.rotatedAt).getTime() < REUSE_GRACE_MS;

        if (!isCurrent && !isRecentPrevious) {
            await this.revoke(session._id);
            throw new UnauthorizedException(errorBody('sessionRevoked', 'Session was revoked, please sign in again'));
        }

        const user = await loadUser(payload.userId);
        if (!user) {
            await this.revoke(session._id);
            throw sessionExpired();
        }

        const issued = isRecentPrevious && session.graceToken ? openToken(session.graceToken) : null;
        if (issued) {
            return { accessToken: this.signAccess(user, session._id), refreshToken: issued, userId: payload.userId };
        }

        const tokens = this.sign(user, session._id);
        // Conditional on the hash we read, so two concurrent rotations can't both win.
        const updated = await this.sessionModel.updateOne(
            { _id: session._id, tokenHash: session.tokenHash, revokedAt: null },
            {
                $set: {
                    previousTokenHash: session.tokenHash,
                    tokenHash: hashToken(tokens.refreshToken),
                    graceToken: sealToken(tokens.refreshToken),
                    rotatedAt: now,
                    lastUsedAt: now,
                    expiresAt: expiryOf(tokens.refreshToken),
                    ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 300) } : {}),
                    ...(meta.ip ? { ip: meta.ip } : {}),
                },
            },
        );

        if (updated.modifiedCount === 0) {
            // Another request rotated it between our read and write; the token
            // we hold is now the "previous" one, which the grace window accepts.
            if (attempt === 0) return this.rotate(refreshToken, meta, loadUser, 1);
            throw sessionExpired();
        }

        return { ...tokens, userId: payload.userId };
    }

    /** True when the session behind an access token is still live. */
    async isActive(sessionId: Id): Promise<boolean> {
        const session = await this.sessionModel.findById(sessionId).select('revokedAt expiresAt').lean();
        return !!session && !session.revokedAt && session.expiresAt > new Date();
    }

    async revoke(sessionId: Id): Promise<void> {
        await this.sessionModel.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }

    /** Sign the user out everywhere, optionally keeping the session making the request. */
    async revokeAllForUser(userId: Id, exceptSessionId?: Id): Promise<void> {
        await this.sessionModel.updateMany(
            {
                userId: new Types.ObjectId(userId.toString()),
                revokedAt: null,
                ...(exceptSessionId ? { _id: { $ne: new Types.ObjectId(exceptSessionId.toString()) } } : {}),
            },
            { $set: { revokedAt: new Date() } },
        );
    }

    private signAccess(user: TokenSubject, sessionId: Id): string {
        const payload = {
            userId: String(user._id),
            clinicId: user.clinicId.toString(),
            email: user.email,
            role: user.role,
            sid: sessionId.toString(),
        };
        return jwt.sign(payload, jwtConfig.accessSecret, {
            expiresIn: jwtConfig.accessExpiration as jwt.SignOptions['expiresIn'],
        });
    }

    private sign(user: TokenSubject, sessionId: Id): TokenPair {
        // `jwtid` makes every refresh token unique. Without it two tokens signed
        // in the same second were byte-identical, so rotation changed nothing and
        // a stolen token could not be told apart from the current one.
        const refreshToken = jwt.sign(
            { userId: String(user._id), clinicId: user.clinicId.toString(), sid: sessionId.toString() },
            jwtConfig.refreshSecret,
            {
                expiresIn: jwtConfig.refreshExpiration as jwt.SignOptions['expiresIn'],
                jwtid: randomUUID(),
            },
        );

        return { accessToken: this.signAccess(user, sessionId), refreshToken };
    }

    private async pruneOldSessions(userId: Id): Promise<void> {
        const stale = await this.sessionModel
            .find({ userId, revokedAt: null })
            .sort({ lastUsedAt: -1 })
            .skip(MAX_SESSIONS_PER_USER)
            .select('_id')
            .lean();
        if (stale.length) {
            await this.sessionModel.updateMany(
                { _id: { $in: stale.map((s) => s._id) } },
                { $set: { revokedAt: new Date() } },
            );
        }
    }
}
