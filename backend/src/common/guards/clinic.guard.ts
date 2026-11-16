import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicStatusService, isReadOnly } from '../clinic-refs/clinic-status.service';
import { errorBody } from '../utils';
import {
    IS_PUBLIC_KEY,
    NO_CLINIC_KEY,
    PLATFORM_KEY,
    READ_ONLY_ALLOWED_KEY,
    Role,
    SUPPORT_ALLOWED_KEY,
} from '../decorators';

const READS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Which clinic a request acts in, and whether it may:
 * - platform console routes are for platform admins only (F13);
 * - everything else needs a clinic, which must not be suspended;
 * - past its end date a clinic is read-only (F13);
 * - a support view (a platform admin looking in) is read-only (F13).
 */
@Injectable()
export class ClinicGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private readonly clinics: ClinicStatusService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const targets = [context.getHandler(), context.getClass()];
        const flag = (key: string) => !!this.reflector.getAllAndOverride<boolean>(key, targets);
        if (flag(IS_PUBLIC_KEY)) return true;

        const request = context.switchToHttp().getRequest();
        const user = request.user ?? {};
        const isPlatformAdmin = user.role === Role.SUPER_ADMIN && !user.clinicId && !user.support;

        if (flag(PLATFORM_KEY)) {
            if (isPlatformAdmin) return true;
            throw new ForbiddenException(errorBody('platformOnly', 'Only platform admins can do this'));
        }

        const clinicId: string | undefined = user.clinicId;
        if (!clinicId) {
            if (flag(NO_CLINIC_KEY)) return true;
            throw new ForbiddenException(errorBody('forbidden', 'Clinic context is required'));
        }

        const status = await this.clinics.get(clinicId);
        if (!status.active) {
            throw new ForbiddenException(errorBody('clinicInactive', 'This clinic account is suspended'));
        }

        if (READS.includes(request.method)) return true;
        if (user.support && !flag(SUPPORT_ALLOWED_KEY)) {
            throw new ForbiddenException(errorBody('supportReadOnly', 'The support view is read-only'));
        }
        if (isReadOnly(status) && !flag(READ_ONLY_ALLOWED_KEY)) {
            throw new ForbiddenException(errorBody('subscriptionEnded', 'The subscription has ended; the clinic is read-only until it is renewed'));
        }
        return true;
    }
}
