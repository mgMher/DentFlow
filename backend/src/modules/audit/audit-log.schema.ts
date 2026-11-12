import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/** Who did it: a staff member, the patient (e.g. a Telegram answer) or the system. */
@Schema({ _id: false })
export class AuditActor {
    @Prop({ enum: ['staff', 'patient', 'system'], default: 'staff' })
    kind: 'staff' | 'patient' | 'system';

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
    userId?: Types.ObjectId;

    /** The name at the time, so the entry still reads right if the account is renamed or removed. */
    @Prop()
    name?: string;

    @Prop()
    role?: string;
}
const AuditActorSchema = SchemaFactory.createForClass(AuditActor);

/** One changed field: `medicalHistory.allergies`, `36.status`… Values are stored as JSON-safe snapshots. */
@Schema({ _id: false })
export class AuditChange {
    @Prop({ required: true })
    field: string;

    @Prop({ type: MongooseSchema.Types.Mixed })
    from?: unknown;

    @Prop({ type: MongooseSchema.Types.Mixed })
    to?: unknown;

    /** A secret or a picture: only the fact that it changed is kept. */
    @Prop()
    masked?: boolean;
}
const AuditChangeSchema = SchemaFactory.createForClass(AuditChange);

/**
 * Who did what, when and to which record (F7). Append-only: the app never
 * updates or deletes an entry (the model refuses to), entries are kept forever.
 */
@Schema({ collection: 'audit_logs', versionKey: false })
export class AuditLog {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Clinic', required: true })
    clinicId: Types.ObjectId;

    @Prop({ required: true, default: () => new Date() })
    at: Date;

    @Prop({ type: AuditActorSchema, required: true })
    actor: AuditActor;

    /** `area.action`, e.g. `patients.update`, `billing.takePayment`, `auth.login`. */
    @Prop({ required: true })
    event: string;

    /** patients, chart, plans, appointments, billing, documents, staff, clinic, catalog, schedule, settings, reminders, auth */
    @Prop({ required: true })
    area: string;

    @Prop()
    method?: string;

    /** The route pattern, e.g. `/api/patients/:id`. */
    @Prop()
    path?: string;

    /** The record acted on. */
    @Prop({ type: MongooseSchema.Types.ObjectId })
    targetId?: Types.ObjectId;

    /** The patient it belongs to, so a patient's history can be listed. */
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Patient' })
    patientId?: Types.ObjectId;

    @Prop({ type: [AuditChangeSchema], default: undefined })
    changes?: AuditChange[];

    /** A few identifying values (invoice number, amount, reason…), never passwords or tokens. */
    @Prop({ type: MongooseSchema.Types.Mixed })
    details?: Record<string, unknown>;

    @Prop()
    ip?: string;

    @Prop()
    userAgent?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ clinicId: 1, _id: -1 });
AuditLogSchema.index({ clinicId: 1, patientId: 1, _id: -1 });
AuditLogSchema.index({ clinicId: 1, 'actor.userId': 1, _id: -1 });
AuditLogSchema.index({ clinicId: 1, area: 1, _id: -1 });

// Append-only: any attempt to change or remove entries through the model fails.
const WRITES = [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
] as const;
for (const op of WRITES) {
    AuditLogSchema.pre(op as any, function () {
        throw new Error('Audit log entries cannot be changed or deleted');
    });
}
