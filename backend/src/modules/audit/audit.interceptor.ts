import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { concatMap, from, Observable, switchMap, tap } from 'rxjs';
import { PLATFORM_KEY } from 'src/common/decorators';
import { AUDIT_AREAS, AuditRequest, DIFF_RULES, DiffRule } from './audit.config';
import { AUDIT_VIEW_KEY, NO_AUDIT_KEY } from './audit.decorators';
import { diffFields, FieldChange, pickDetails } from './audit-diff';
import { AuditService } from './audit.service';

const WRITES = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SECRET = /password|token|secret|apikey|api_key|authToken/i;
/** A support view logs each screen's reads once per this long (a page makes several calls). */
const SUPPORT_VIEW_REPEAT_MS = 10 * 60_000;
const SUPPORT_VIEW_SKIP = ['AuthController', 'NotificationsController'];

type Doc = Record<string, any> | null;

const idOf = (v: unknown): string | undefined => {
    const raw = v && typeof v === 'object' && '_id' in (v as object) ? (v as { _id: unknown })._id : v;
    const s = raw == null ? undefined : String(raw);
    return s && Types.ObjectId.isValid(s) ? s : undefined;
};

/**
 * Logs every successful write by a signed-in user, and reads marked
 * `@AuditView()`, as `area.handler` with who, when, the record, its patient,
 * and — for the records in `DIFF_RULES` — each changed field's old and new
 * value. Failed requests are not logged (nothing changed).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
    /** Support views already logged: session + route + ids → when. */
    private readonly supportSeen = new Map<string, number>();

    constructor(
        private readonly reflector: Reflector,
        private readonly audit: AuditService,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http') return next.handle();
        const req = context.switchToHttp().getRequest();
        const targets = [context.getHandler(), context.getClass()];
        const className = context.getClass().name;
        const area = className in AUDIT_AREAS ? AUDIT_AREAS[className] : className.replace(/Controller$/, '').toLowerCase();

        // F13: a platform admin looking into a clinic — every screen they open is in the clinic's log.
        if (req.user?.support && req.method === 'GET') {
            // The support person's own account and the inbox are not the clinic's records.
            if (SUPPORT_VIEW_SKIP.includes(className)) return next.handle();
            return next.handle().pipe(tap(() => void this.supportView(req, area ?? className.replace(/Controller$/, '').toLowerCase())));
        }

        const view = this.reflector.getAllAndOverride<boolean>(AUDIT_VIEW_KEY, targets);
        if (!WRITES.includes(req.method) && !view) return next.handle();
        if (this.reflector.getAllAndOverride<boolean>(NO_AUDIT_KEY, targets)) return next.handle();
        // F13: platform console actions have no clinic of their own; the clinic they act on, if any.
        const platform = !!this.reflector.getAllAndOverride<boolean>(PLATFORM_KEY, targets);
        const clinicId = platform ? idOf(req.params?.clinicId) : req.user?.clinicId;
        if (!clinicId && !platform) return next.handle();
        if (!area) return next.handle();

        const event = `${area}.${context.getHandler().name}`;
        const rule = DIFF_RULES[event];
        const r = (): AuditRequest => ({
            params: req.params ?? {},
            body: req.body ?? {},
            clinicId: clinicId ? new Types.ObjectId(clinicId) : (null as unknown as Types.ObjectId),
        });

        return from(this.load(rule, r())).pipe(
            switchMap((before) =>
                next.handle().pipe(
                    concatMap(async (data) => {
                        await this.write(req, event, rule, r(), before, data);
                        return data;
                    }),
                ),
            ),
        );
    }

    private async load(rule: DiffRule | undefined, r: AuditRequest): Promise<Doc> {
        if (!rule) return null;
        try {
            const filter = rule.filter(r);
            if (!filter) return null;
            return await this.connection.model(rule.model).findOne(filter).lean<Record<string, any>>();
        } catch {
            return null;
        }
    }

    private details(event: string, r: AuditRequest, data: any, before: Doc, after: Doc) {
        // A download returns the file itself; name the document instead.
        if (event === 'documents.file') return before ? { title: before.title } : undefined;
        const details = pickDetails(r.body, data);
        // Amounts need their currency to be read; a payment's answer may not carry it, its invoice does.
        const currency = after?.currency ?? before?.currency;
        if (details && !details.currency && typeof currency === 'string' && ['amount', 'totalAmount'].some((k) => k in details)) {
            details.currency = currency;
        }
        return details;
    }

    private async write(req: any, event: string, rule: DiffRule | undefined, r: AuditRequest, before: Doc, raw: unknown) {
        // The response may already be wrapped in the `{ statusCode, data }` envelope.
        const data: any = raw && typeof raw === 'object' && 'statusCode' in raw && 'data' in raw ? (raw as any).data : raw;
        const after = rule ? await this.load(rule, r) : null;

        let changes: FieldChange[] | undefined;
        if (rule) {
            const b = rule.pick ? rule.pick(before, r) : before;
            const a = rule.pick ? rule.pick(after, r) : after;
            const fields = rule.fields ? rule.fields(r, b, a) : [...Object.keys(r.body), ...(rule.extra ?? [])];
            changes = diffFields(b, a, fields);
            // A secret sent in the request but stored under another name (sealed): "changed", no value.
            for (const key of Object.keys(r.body)) {
                if (SECRET.test(key) && r.body[key] != null && !changes.some((c) => c.field === key) && !(b && key in b)) {
                    changes.push({ field: key, masked: true });
                }
            }
        }

        const area = event.split('.')[0];
        const patientId =
            idOf(r.params.patientId) ??
            (area === 'patients' ? idOf(r.params.id) ?? idOf(data) : undefined) ??
            idOf(after?.patientId) ??
            idOf(before?.patientId) ??
            idOf(data?.patientId) ??
            idOf(r.body?.patientId);

        const platform = area === 'platform';
        await this.audit.record({
            clinicId: platform ? idOf(r.params.clinicId) : req.user.clinicId,
            // A support view's own writes (signing out of it) are DentFlow's, not a clinic admin's.
            actor: {
                kind: platform ? 'platform' : req.user.support ? 'support' : 'staff',
                userId: req.user.userId,
                name: req.user.name,
                role: req.user.support ? 'super_admin' : req.user.role,
            },
            event,
            method: req.method,
            path: req.route?.path,
            // The most specific id in the route: the payment, not its invoice.
            targetId: idOf(r.params.paymentId) ?? idOf(r.params.entryId) ?? idOf(r.params.id) ?? idOf(data),
            patientId,
            changes,
            details: this.details(event, r, data, before, after),
            ip: req.ip,
            userAgent: req.headers?.['user-agent'],
        });
    }

    /** One entry per screen of a support view: what was looked at, and whose record. */
    private async supportView(req: any, section: string) {
        const params = req.params ?? {};
        const key = `${req.user.sessionId}:${req.route?.path}:${JSON.stringify(params)}`;
        const now = Date.now();
        if ((this.supportSeen.get(key) ?? 0) > now - SUPPORT_VIEW_REPEAT_MS) return;
        this.supportSeen.set(key, now);
        if (this.supportSeen.size > 5000) {
            for (const [k, at] of this.supportSeen) if (at <= now - SUPPORT_VIEW_REPEAT_MS) this.supportSeen.delete(k);
        }
        const path: string = req.route?.path ?? '';
        await this.audit.record({
            clinicId: req.user.clinicId,
            actor: { kind: 'support', userId: req.user.userId, name: req.user.name, role: 'super_admin' },
            event: 'support.view',
            method: 'GET',
            path,
            targetId: idOf(params.id) ?? idOf(params.patientId),
            patientId: idOf(params.patientId) ?? (/\/patients\/:id\b/.test(path) ? idOf(params.id) : undefined),
            details: { section },
            ip: req.ip,
            userAgent: req.headers?.['user-agent'],
        });
    }
}
