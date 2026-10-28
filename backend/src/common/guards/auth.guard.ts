import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { jwtConfig } from 'src/config';
import { User, UserDocument } from 'src/modules/auth/auth.schema';
import { SessionsService } from 'src/modules/auth/sessions.service';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly sessions: SessionsService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException('Access token is required');
        }

        let payload: jwt.JwtPayload;
        try {
            payload = jwt.verify(token, jwtConfig.accessSecret) as jwt.JwtPayload;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        // The token's claims are a snapshot from login. Re-read the account so a
        // deactivated, demoted or moved user loses access on their next request
        // instead of when the token expires. A role mismatch returns 401, which
        // makes the client refresh and receive a token with the current role.
        // A token from before per-device sessions has no `sid`; it fails here
        // and the client signs in again once.
        const [user, sessionLive] = await Promise.all([
            this.userModel.findById(payload.userId).select('isActive role clinicId').lean(),
            payload.sid ? this.sessions.isActive(payload.sid) : Promise.resolve(false),
        ]);

        if (
            !sessionLive ||
            !user ||
            !user.isActive ||
            user.role !== payload.role ||
            user.clinicId?.toString() !== payload.clinicId
        ) {
            throw new UnauthorizedException('Session is no longer valid');
        }

        request.user = {
            userId: payload.userId,
            clinicId: payload.clinicId,
            email: payload.email,
            role: payload.role,
            sessionId: payload.sid,
        };

        return true;
    }

    private extractToken(request: any): string | null {
        const authHeader = request.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return null;
    }
}
