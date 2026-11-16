import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import { Role } from 'src/common/decorators';
import { ClinicStatusService, supportAllowed } from 'src/common/clinic-refs/clinic-status.service';
import { clinicDayRange, DEFAULT_CLINIC_TIMEZONE, errorBody, isCalendarDate } from 'src/common/utils';
import { AuditLog, AuditLogDocument } from '../audit/audit-log.schema';
import { User, UserDocument } from '../auth/auth.schema';
import { AuthService } from '../auth/auth.service';
import { SessionMeta, SessionsService } from '../auth/sessions.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { Clinic, ClinicDocument } from '../clinics/clinic.schema';
import { ClinicState, CreatePlatformAdminDto, PlatformAuditQueryDto, QueryClinicsDto, UpdateSubscriptionDto } from './dto/platform.dto';

type Id = Types.ObjectId;
const DAY = 86_400_000;
/** "Ending" this many days before the end date; the clinic's admins see a warning then too. */
export const ENDING_DAYS = 7;
const SIGN_IN_EVENTS = ['auth.login', 'auth.loginFailed', 'auth.register'];
const oid = (id: string | Id) => new Types.ObjectId(id.toString());

/** Per clinic, from one `$group` over a collection. */
type CountMap = Map<string, { count: number; bytes?: number; last?: Date }>;

const stateOf = (clinic: { isActive?: boolean; subscription?: { status?: string; expiresAt?: Date } }, now = new Date()): ClinicState => {
    if (clinic.isActive === false) return 'suspended';
    const ends = clinic.subscription?.expiresAt;
    if (ends && ends <= now) return 'ended';
    if (ends && ends.getTime() - now.getTime() <= ENDING_DAYS * DAY) return 'ending';
    return clinic.subscription?.status === 'trial' ? 'trial' : 'active';
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * F13: the platform console — every clinic with its plan, end date and use;
 * suspending, extending, helping admins sign in, support views, the platform
 * log and the platform admins themselves.
 */
@Injectable()
export class PlatformService {
    constructor(
        @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
        @InjectConnection() private readonly connection: Connection,
        private readonly clinicStatus: ClinicStatusService,
        private readonly sessions: SessionsService,
        private readonly twoFactor: TwoFactorService,
        private readonly auth: AuthService,
    ) {}

    // ── Clinics ─────────────────────────────────────────────────────────

    async listClinics(query: QueryClinicsDto) {
        const filter: Record<string, unknown> = {};
        if (query.search) {
            const re = new RegExp(escapeRegex(query.search), 'i');
            filter.$or = [{ name: re }, { email: re }, { phone: re }];
        }
        const clinics = await this.clinicModel
            .find(filter)
            .select('name email phone isActive subscription createdAt suspendReason supportAccessUntil')
            .sort({ createdAt: -1 })
            .lean<(Clinic & { _id: Id; createdAt: Date })[]>();
        const usage = await this.usage(clinics.map((c) => c._id));
        const now = new Date();
        return clinics
            .map((c) => ({ ...c, state: stateOf(c, now), usage: usage(c._id) }))
            .filter((c) => !query.state || c.state === query.state);
    }

    async clinic(clinicId: Id) {
        const clinic = await this.clinicModel
            .findById(clinicId)
            .select('-workingHours -logo')
            .lean<Clinic & { _id: Id; createdAt: Date }>();
        if (!clinic) throw new NotFoundException(errorBody('clinicNotFound', 'Clinic not found'));
        const [usage, admins, staffByRole] = await Promise.all([
            this.usage([clinic._id]),
            this.userModel
                .find({ clinicId, role: Role.CLINIC_ADMIN })
                .select('email firstName lastName isActive lastLogin twoFactorEnabledAt lockedUntil')
                .sort({ createdAt: 1 })
                .lean(),
            this.connection
                .model('UserProfile')
                .aggregate<{ _id: string; count: number }>([{ $match: { clinicId, isActive: true } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
        ]);
        return {
            ...clinic,
            state: stateOf(clinic),
            usage: usage(clinic._id),
            staffByRole: Object.fromEntries(staffByRole.map((r) => [r._id, r.count])),
            admins: admins.map(({ twoFactorEnabledAt, lockedUntil, ...a }) => ({
                ...a,
                twoFactorEnabled: !!twoFactorEnabledAt,
                locked: !!lockedUntil && lockedUntil > new Date(),
            })),
        };
    }

    /** Plan, status and the last day of access (end of that day in the clinic's timezone); `null` for no end. */
    async updateSubscription(clinicId: Id, dto: UpdateSubscriptionDto) {
        const clinic = await this.clinicModel.findById(clinicId).select('timezone').lean();
        if (!clinic) throw new NotFoundException(errorBody('clinicNotFound', 'Clinic not found'));
        const set: Record<string, unknown> = {};
        const unset: Record<string, 1> = {};
        if (dto.plan !== undefined) set['subscription.plan'] = dto.plan;
        if (dto.status !== undefined) set['subscription.status'] = dto.status;
        if (dto.endsOn === null) unset['subscription.expiresAt'] = 1;
        else if (dto.endsOn !== undefined) {
            if (!isCalendarDate(dto.endsOn)) throw new BadRequestException(errorBody('invalidDate', 'Not a valid date'));
            set['subscription.expiresAt'] = clinicDayRange(dto.endsOn, clinic.timezone || DEFAULT_CLINIC_TIMEZONE).end;
        }
        await this.clinicModel.updateOne({ _id: clinicId }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
        this.clinicStatus.invalidate(clinicId);
        return this.clinic(clinicId);
    }

    /** Nobody in the clinic can sign in or work until it is reactivated; everyone is signed out now. */
    async suspend(clinicId: Id, reason: string) {
        const r = await this.clinicModel.updateOne(
            { _id: clinicId, isActive: { $ne: false } },
            { $set: { isActive: false, suspendedAt: new Date(), suspendReason: reason } },
        );
        if (!r.matchedCount) await this.assertClinic(clinicId, 'clinicAlreadySuspended');
        await this.connection.collection('auth_sessions').updateMany({ clinicId, revokedAt: null }, { $set: { revokedAt: new Date() } });
        this.clinicStatus.invalidate(clinicId);
        return this.clinic(clinicId);
    }

    async reactivate(clinicId: Id) {
        const r = await this.clinicModel.updateOne(
            { _id: clinicId, isActive: false },
            { $set: { isActive: true }, $unset: { suspendedAt: 1, suspendReason: 1 } },
        );
        if (!r.matchedCount) await this.assertClinic(clinicId, 'clinicNotSuspended');
        this.clinicStatus.invalidate(clinicId);
        return this.clinic(clinicId);
    }

    // ── Helping a clinic's admins sign in ───────────────────────────────

    /** Email a clinic admin a password-reset link (they choose the password; we never see it). */
    async sendPasswordReset(clinicId: Id, userId: Id) {
        const user = await this.clinicAdmin(clinicId, userId);
        const sent = await this.auth.sendPasswordLink(user);
        return { sent, email: user.email };
    }

    /** A lost phone: two-factor off, signed out everywhere; they set it up again at their next sign-in. */
    async resetTwoFactor(clinicId: Id, userId: Id) {
        const user = await this.clinicAdmin(clinicId, userId);
        await this.twoFactor.clear(user._id);
        await this.sessions.revokeAllForUser(user._id);
        // A lockout from wrong codes would keep them out too.
        await this.userModel.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } });
        return { reset: true };
    }

    // ── Support views ───────────────────────────────────────────────────

    /** A read-only view of the clinic, only while its admin allows it (at most an hour at a time). */
    async startSupport(clinicId: Id, adminId: string, meta: SessionMeta) {
        const clinic = await this.clinicModel.findById(clinicId).select('name isActive supportAccessUntil').lean();
        if (!clinic) throw new NotFoundException(errorBody('clinicNotFound', 'Clinic not found'));
        if (clinic.isActive === false) throw new ForbiddenException(errorBody('clinicInactive', 'This clinic account is suspended'));
        this.clinicStatus.invalidate(clinicId);
        const status = await this.clinicStatus.get(clinicId);
        if (!supportAllowed(status)) {
            throw new ForbiddenException(errorBody('supportAccessOff', 'The clinic has not allowed support access'));
        }
        const admin = await this.userModel.findById(adminId).select('email role').lean();
        if (!admin) throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        const session = await this.sessions.startSupport(admin, clinicId, status.supportUntil!, meta);
        return { ...session, clinic: { _id: clinic._id, name: clinic.name } };
    }

    // ── The platform log ────────────────────────────────────────────────

    /** Platform admins' actions and support views, and sign-ins in every clinic; newest first. */
    async audit(query: PlatformAuditQueryDto) {
        const platform = { 'actor.kind': { $in: ['platform', 'support'] } };
        const signins = { area: 'auth', event: { $in: SIGN_IN_EVENTS } };
        const kind = query.kind ?? 'all';
        const filter: Record<string, unknown> = kind === 'platform' ? platform : kind === 'signins' ? signins : { $or: [platform, signins] };
        if (query.clinicId) filter.clinicId = oid(query.clinicId);
        if (query.before) filter._id = { $lt: oid(query.before) };
        const limit = query.limit ?? 50;
        const rows = await this.auditModel.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
        const items = rows.slice(0, limit);
        const clinicIds = Array.from(new Set(items.map((e) => e.clinicId?.toString()).filter((x): x is string => !!x)));
        const names = new Map(
            (await this.clinicModel.find({ _id: { $in: clinicIds.map(oid) } }).select('name').lean()).map((c) => [c._id.toString(), c.name]),
        );
        return {
            items: items.map((e) => ({ ...e, clinic: e.clinicId ? { _id: e.clinicId, name: names.get(e.clinicId.toString()) ?? null } : null })),
            next: rows.length > limit ? String(items[items.length - 1]._id) : null,
        };
    }

    // ── Platform admins ─────────────────────────────────────────────────

    async admins() {
        const admins = await this.userModel
            .find({ role: Role.SUPER_ADMIN, clinicId: null })
            .select('email firstName lastName isActive lastLogin twoFactorEnabledAt createdAt')
            .sort({ createdAt: 1 })
            .lean();
        return admins.map(({ twoFactorEnabledAt, ...a }) => ({ ...a, twoFactorEnabled: !!twoFactorEnabledAt }));
    }

    /** A new platform admin chooses their password from an emailed link (valid a day). */
    async addAdmin(dto: CreatePlatformAdminDto) {
        const email = dto.email.toLowerCase();
        if (await this.userModel.exists({ email })) {
            throw new ConflictException(errorBody('accountEmailTaken', 'An account with this email already exists'));
        }
        const user = await this.userModel.create({
            email,
            // Nobody knows it; the emailed link sets the real one.
            password: await bcrypt.hash(randomBytes(32).toString('base64url'), 12),
            role: Role.SUPER_ADMIN,
            firstName: dto.firstName,
            lastName: dto.lastName,
        });
        const sent = await this.auth.sendPasswordLink(user, true);
        return { _id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, isActive: true, inviteSent: sent };
    }

    /** Deactivated and signed out. Not yourself, and never the last one. */
    async removeAdmin(adminId: Id, actingId: string) {
        if (adminId.equals(actingId)) throw new BadRequestException(errorBody('cannotDeactivateSelf', 'You cannot remove yourself'));
        const admin = await this.userModel.findOne({ _id: adminId, role: Role.SUPER_ADMIN, clinicId: null, isActive: true }).select('_id').lean();
        if (!admin) throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        const others = await this.userModel.countDocuments({ role: Role.SUPER_ADMIN, clinicId: null, isActive: true, _id: { $ne: adminId } });
        if (!others) throw new BadRequestException(errorBody('lastPlatformAdmin', 'The last platform admin cannot be removed'));
        await this.userModel.updateOne({ _id: adminId }, { $set: { isActive: false } });
        await this.sessions.revokeAllForUser(adminId);
        return { removed: true };
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    /**
     * Staff, patients, documents (count and bytes) and last sign-in per
     * clinic; appointments and invoices over the last 30 days.
     */
    private async usage(clinicIds: Id[]) {
        const since = new Date(Date.now() - 30 * DAY);
        const group = async (model: string, match: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<CountMap> => {
            const rows = await this.connection
                .model(model)
                .aggregate<{ _id: Id; count: number; bytes?: number; last?: Date }>([
                    { $match: { clinicId: { $in: clinicIds }, ...match } },
                    { $group: { _id: '$clinicId', count: { $sum: 1 }, ...extra } },
                ]);
            return new Map(rows.map((r) => [r._id.toString(), r]));
        };
        const [staff, patients, appointments, invoices, documents, logins] = await Promise.all([
            group('UserProfile', { isActive: true }),
            group('Patient', {}),
            group('Appointment', { startTime: { $gte: since } }),
            group('Invoice', { createdAt: { $gte: since } }),
            group('PatientDocument', { deletedAt: null }, { bytes: { $sum: '$file.size' } }),
            group('User', { lastLogin: { $ne: null } }, { last: { $max: '$lastLogin' } }),
        ]);
        return (id: Id) => {
            const k = id.toString();
            return {
                staff: staff.get(k)?.count ?? 0,
                patients: patients.get(k)?.count ?? 0,
                appointments30: appointments.get(k)?.count ?? 0,
                invoices30: invoices.get(k)?.count ?? 0,
                documents: documents.get(k)?.count ?? 0,
                documentBytes: documents.get(k)?.bytes ?? 0,
                lastSignIn: logins.get(k)?.last ?? null,
            };
        };
    }

    private async assertClinic(clinicId: Id, code: string) {
        if (!(await this.clinicModel.exists({ _id: clinicId }))) throw new NotFoundException(errorBody('clinicNotFound', 'Clinic not found'));
        throw new ConflictException(errorBody(code, code === 'clinicAlreadySuspended' ? 'The clinic is already suspended' : 'The clinic is not suspended'));
    }

    private async clinicAdmin(clinicId: Id, userId: Id) {
        const user = await this.userModel.findOne({ _id: userId, clinicId, role: Role.CLINIC_ADMIN }).select('email firstName clinicId').lean();
        if (!user) throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        return user;
    }
}
