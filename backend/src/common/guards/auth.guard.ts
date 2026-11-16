import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { jwtConfig } from 'src/config';
import { User, UserDocument } from 'src/modules/auth/auth.schema';
import { SessionsService } from 'src/modules/auth/sessions.service';
import { IS_PUBLIC_KEY, Role } from '../decorators';
import { ClinicStatusService, supportAllowed } from '../clinic-refs/clinic-status.service';
import { errorBody } from '../utils';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly sessions: SessionsService,
        private readonly clinics: ClinicStatusService,
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
            this.userModel.findById(payload.userId).select('isActive role clinicId firstName lastName').lean(),
            payload.sid ? this.sessions.isActive(payload.sid) : Promise.resolve(false),
        ]);

        const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

        // F13: a platform admin looking into a clinic that allowed it. Read-only
        // (ClinicGuard); seen there as a clinic admin, logged as support.
        if (payload.support) {
            const allowed =
                sessionLive &&
                !!user &&
                user.isActive &&
                user.role === Role.SUPER_ADMIN &&
                !user.clinicId &&
                !!payload.clinicId &&
                supportAllowed(await this.clinics.get(payload.clinicId));
            if (!allowed) throw new UnauthorizedException(errorBody('supportEnded', 'The support view has ended'));
            request.user = {
                userId: payload.userId,
                clinicId: payload.clinicId,
                email: payload.email,
                role: Role.CLINIC_ADMIN,
                sessionId: payload.sid,
                support: true,
                name,
            };
            return true;
        }

        if (
            !sessionLive ||
            !user ||
            !user.isActive ||
            user.role !== payload.role ||
            // Platform admins (F13) have no clinic on either side.
            (user.clinicId?.toString() ?? null) !== (payload.clinicId ?? null)
        ) {
            throw new UnauthorizedException('Session is no longer valid');
        }

        request.user = {
            userId: payload.userId,
            clinicId: payload.clinicId ?? undefined,
            email: payload.email,
            role: payload.role,
            sessionId: payload.sid,
            // For the audit log: the name at the time of the action.
            name,
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
