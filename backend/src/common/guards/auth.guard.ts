import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { jwtConfig } from 'src/config';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
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

        try {
            const payload = jwt.verify(token, jwtConfig.accessSecret) as any;
            request.user = {
                userId: payload.userId,
                clinicId: payload.clinicId,
                email: payload.email,
                role: payload.role,
            };
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        return true;
    }

    private extractToken(request: any): string | null {
        const authHeader = request.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        const accessToken = request.headers['access-token'];
        if (accessToken) return accessToken;
        return null;
    }
}
