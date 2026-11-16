import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clinic, ClinicDocument } from 'src/modules/clinics/clinic.schema';

/** What every request needs to know about its clinic (F13). */
export interface ClinicStatus {
    exists: boolean;
    /** False when the platform suspended it. */
    active: boolean;
    /** When the trial or subscription ends; `null` for no end. Past it the clinic is read-only. */
    endsAt: Date | null;
    /** Until when support may look in; `null` when not allowed. */
    supportUntil: Date | null;
}

/** Long enough to skip a query per request, short enough for other server instances. */
const CACHE_TTL_MS = 60_000;

/**
 * The clinic's state for the guards, cached for a minute. Changes made here
 * (suspending, extending, allowing support) call `invalidate`, so they apply
 * at once on this instance.
 */
@Injectable()
export class ClinicStatusService {
    private readonly cache = new Map<string, { status: ClinicStatus; until: number }>();

    constructor(@InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>) {}

    async get(clinicId: string | Types.ObjectId): Promise<ClinicStatus> {
        const key = clinicId.toString();
        const cached = this.cache.get(key);
        if (cached && cached.until > Date.now()) return cached.status;

        const clinic = Types.ObjectId.isValid(key)
            ? await this.clinicModel.findById(key).select('isActive subscription.expiresAt supportAccessUntil').lean()
            : null;
        const status: ClinicStatus = {
            exists: !!clinic,
            active: !!clinic && clinic.isActive !== false,
            endsAt: clinic?.subscription?.expiresAt ?? null,
            supportUntil: clinic?.supportAccessUntil ?? null,
        };
        this.cache.set(key, { status, until: Date.now() + CACHE_TTL_MS });
        return status;
    }

    invalidate(clinicId: string | Types.ObjectId) {
        this.cache.delete(clinicId.toString());
    }
}

/** Past its end date a clinic can be read but not changed. */
export const isReadOnly = (status: ClinicStatus, now = new Date()) => !!status.endsAt && status.endsAt <= now;
export const supportAllowed = (status: ClinicStatus, now = new Date()) => !!status.supportUntil && status.supportUntil > now;
