import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ClinicRefsService } from 'src/common/clinic-refs';
import { clinicDayRange, DEFAULT_CLINIC_TIMEZONE } from 'src/common/utils/clinic-time.util';
import { AuditActor, AuditLog, AuditLogDocument } from './audit-log.schema';
import { FieldChange } from './audit-diff';
import { AuditPageDto, QueryAuditDto } from './dto/audit.dto';

export interface AuditEntryInput {
    /** Empty only for platform-level entries (F13). */
    clinicId?: Types.ObjectId | string;
    actor: AuditActor;
    event: string;
    method?: string;
    path?: string;
    targetId?: Types.ObjectId | string | null;
    patientId?: Types.ObjectId | string | null;
    changes?: FieldChange[];
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
}

const toId = (v: unknown) => {
    const s = v && typeof v === 'object' && '_id' in (v as object) ? (v as { _id: unknown })._id : v;
    return s && Types.ObjectId.isValid(String(s)) ? new Types.ObjectId(String(s)) : undefined;
};

/** Writes and reads the audit log (F7). There is deliberately no update or delete. */
@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
        @InjectConnection() private readonly connection: Connection,
        private readonly clinicRefs: ClinicRefsService,
    ) {}

    /**
     * Never throws: the change it describes has already happened, so a failed
     * write is logged to the server log instead of failing the request.
     */
    async record(entry: AuditEntryInput): Promise<void> {
        try {
            await this.auditModel.create({
                clinicId: toId(entry.clinicId),
                at: new Date(),
                actor: entry.actor,
                event: entry.event,
                area: entry.event.split('.')[0],
                method: entry.method,
                path: entry.path,
                targetId: toId(entry.targetId),
                patientId: toId(entry.patientId),
                changes: entry.changes?.length ? entry.changes : undefined,
                details: entry.details,
                ip: entry.ip,
                userAgent: entry.userAgent?.slice(0, 300),
            });
        } catch (err) {
            this.logger.error(`Audit entry for ${entry.event} not written: ${(err as Error).message}`);
        }
    }

    /** The whole clinic's log, newest first, with filters. */
    async list(clinicId: Types.ObjectId, query: QueryAuditDto) {
        const filter: Record<string, unknown> = { clinicId };
        if (query.userId) filter['actor.userId'] = new Types.ObjectId(query.userId);
        if (query.area) filter.area = query.area;
        if (query.patientId) filter.patientId = new Types.ObjectId(query.patientId);
        if (query.from || query.to) {
            const tz = await this.timezone(clinicId);
            const at: Record<string, Date> = {};
            if (query.from) at.$gte = clinicDayRange(query.from, tz).start;
            if (query.to) at.$lt = clinicDayRange(query.to, tz).end;
            filter.at = at;
        }
        return this.page(filter, query);
    }

    /** Everything recorded about one patient. */
    async patientHistory(clinicId: Types.ObjectId, patientId: Types.ObjectId, query: AuditPageDto) {
        await this.clinicRefs.assertPatient(clinicId, patientId);
        return this.page({ clinicId, patientId }, query);
    }

    private async page(filter: Record<string, unknown>, query: AuditPageDto) {
        const limit = query.limit ?? 50;
        if (query.before) filter._id = { $lt: new Types.ObjectId(query.before) };
        const rows = await this.auditModel
            .find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({ path: 'patientId', select: 'firstName lastName patronymic' })
            .lean();
        const items = rows.slice(0, limit);
        return { items, next: rows.length > limit ? String(items[items.length - 1]._id) : null };
    }

    private async timezone(clinicId: Types.ObjectId): Promise<string> {
        const clinic = await this.connection.model('Clinic').findById(clinicId).select('timezone').lean<{ timezone?: string }>();
        return clinic?.timezone || DEFAULT_CLINIC_TIMEZONE;
    }
}
