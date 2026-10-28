import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from 'src/modules/clinics/clinic.schema';
import { errorBody } from '../utils';
import { IS_PUBLIC_KEY } from '../decorators';

/** A suspended clinic is locked out within this long; short enough for support, long enough to skip a query per request. */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class ClinicGuard implements CanActivate {
    private readonly activeCache = new Map<string, { active: boolean; until: number }>();

    constructor(
        private reflector: Reflector,
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const clinicId: string | undefined = context.switchToHttp().getRequest().user?.clinicId;

        if (!clinicId) {
            throw new ForbiddenException(errorBody('forbidden', 'Clinic context is required'));
        }

        if (!(await this.isActive(clinicId))) {
            throw new ForbiddenException(errorBody('clinicInactive', 'This clinic account is suspended'));
        }

        return true;
    }

    private async isActive(clinicId: string): Promise<boolean> {
        const cached = this.activeCache.get(clinicId);
        if (cached && cached.until > Date.now()) return cached.active;

        const clinic = await this.clinicModel.findById(clinicId).select('isActive').lean();
        const active = !!clinic && clinic.isActive !== false;
        this.activeCache.set(clinicId, { active, until: Date.now() + CACHE_TTL_MS });
        return active;
    }
}
