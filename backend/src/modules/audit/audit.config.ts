import { Types } from 'mongoose';
import { Currency, toMajor } from 'src/common/utils';

/**
 * Which area each controller's actions belong to (the first half of an event
 * name). `null`: not logged at all. A controller missing from this list is
 * caught by `audit.config.spec.ts`.
 */
export const AUDIT_AREAS: Record<string, string | null> = {
    PatientsController: 'patients',
    FamilyController: 'patients',
    DentalRecordsController: 'chart',
    TreatmentPlansController: 'plans',
    AppointmentsController: 'appointments',
    BillingController: 'billing',
    AccountController: 'billing',
    CashController: 'billing',
    FiscalController: 'billing',
    DocumentsController: 'documents',
    PerioController: 'perio',
    UsersController: 'staff',
    ClinicsController: 'clinic',
    TreatmentsController: 'catalog',
    ScheduleController: 'schedule',
    SettingsController: 'settings',
    RemindersController: 'reminders',
    AuthController: 'auth',
    AuditController: null,
    ReportsController: null,
    CommissionController: 'commission',
    // Writes a file from what the page already shows; reads nothing.
    ExportsController: null,
    // Personal inbox; and patients' Telegram answers are logged by the service.
    NotificationsController: null,
    TelegramWebhookController: null,
};

export interface AuditRequest {
    params: Record<string, string>;
    body: Record<string, unknown>;
    clinicId: Types.ObjectId;
}

/**
 * For the important records, how to load the record before and after the
 * change. The fields compared are the ones the request sent (plus `extra`);
 * `pick` reshapes the record first (e.g. one tooth out of the chart).
 */
export interface DiffRule {
    model: string;
    filter: (r: AuditRequest) => Record<string, unknown> | null;
    pick?: (doc: Record<string, any> | null, r: AuditRequest) => Record<string, unknown> | null;
    /** Fields to compare; default: the request body's keys. */
    fields?: (r: AuditRequest, before: Record<string, unknown> | null, after: Record<string, unknown> | null) => string[];
    extra?: string[];
}

const oid = (id: unknown) => (typeof id === 'string' && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null);
const byId = (param = 'id') => (r: AuditRequest) => (oid(r.params[param]) ? { _id: oid(r.params[param]), clinicId: r.clinicId } : null);
const byPatient = (r: AuditRequest) => (oid(r.params.patientId) ? { patientId: oid(r.params.patientId), clinicId: r.clinicId } : null);
const clinic = (r: AuditRequest) => ({ _id: r.clinicId });
const only = (...fields: string[]) => () => fields;
const allKeys = (_r: AuditRequest, b: Record<string, unknown> | null, a: Record<string, unknown> | null) =>
    Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]));

/** Teeth from the chart as `36.status`, `36.surfaces`, `36.notes`; a tooth never charted counts as healthy. */
const teeth = (numbers: number[]) => (doc: Record<string, any> | null) => {
    const out: Record<string, unknown> = {};
    for (const n of numbers) {
        const t = (doc?.teeth ?? []).find((x: any) => x.toothNumber === n);
        out[`${n}.status`] = t?.status ?? 'healthy';
        out[`${n}.surfaces`] = (t?.surfaces ?? []).map((s: any) => `${s.surface}:${s.status}`).sort();
        out[`${n}.notes`] = t?.notes ?? null;
    }
    return out;
};

/** Mixed chart (F12): whether the permanent tooth is on the chart. */
const onChart = (numbers: number[]) => (doc: Record<string, any> | null) => {
    const out: Record<string, unknown> = {};
    for (const n of numbers) out[`${n}.erupted`] = (doc?.teeth ?? []).some((x: any) => x.toothNumber === n);
    return out;
};

/** One tooth of a perio exam as `16.pd` "3 2 3 / 3 2 4" (cheek side / tongue side), `16.mobility`, … */
const perioTooth = (doc: Record<string, any> | null, r: AuditRequest) => {
    const n = Number(r.params.toothNumber);
    const t = (doc?.teeth ?? []).find((x: any) => x.toothNumber === n);
    if (!t) return null;
    const sites: any[] = t.sites ?? [];
    const row = (f: (s: any) => string) => `${sites.slice(0, 3).map(f).join(' ')} / ${sites.slice(3).map(f).join(' ')}`;
    const num = (k: string) => (s: any) => (s?.[k] == null ? '–' : String(s[k]));
    const flag = (k: string) => (s: any) => (s?.[k] ? '●' : '○');
    return {
        [`${n}.missing`]: !!t.missing,
        [`${n}.implant`]: !!t.implant,
        [`${n}.mobility`]: t.mobility ?? null,
        [`${n}.furcation`]: t.furcation ?? null,
        [`${n}.pd`]: row(num('pd')),
        [`${n}.rec`]: row(num('rec')),
        [`${n}.bop`]: row(flag('bop')),
        [`${n}.sup`]: row(flag('sup')),
        [`${n}.plaque`]: row(flag('plaque')),
    };
};

/** Invoices keep money in minor units (cents); the log shows it as people write it. */
const invoice = (doc: Record<string, any> | null) =>
    doc
        ? {
              ...doc,
              totalAmount: toMajor(doc.totalAmount, doc.currency as Currency),
              paidAmount: toMajor(doc.paidAmount, doc.currency as Currency),
          }
        : null;

/** Guardians as `guardian.<id>`: "mother, main" plus who (a linked patient's id or the contact's name and phone). */
const guardians = (doc: Record<string, any> | null) => {
    const out: Record<string, unknown> = {};
    for (const g of doc?.guardians ?? []) {
        out[`guardians.${g._id}`] = [g.relationship, g.isPrimary ? 'primary' : null, g.patientId ? `patient:${g.patientId}` : `${g.name} ${g.phone}`]
            .filter(Boolean)
            .join(' · ');
    }
    return out;
};

/** Staff availability lives under `schedule` on the profile. */
const staffProfile = (doc: Record<string, any> | null) =>
    doc ? { ...doc, defaultAvailability: doc.schedule?.defaultAvailability } : null;

export const DIFF_RULES: Record<string, DiffRule> = {
    'patients.update': { model: 'Patient', filter: byId() },
    'patients.updateStatus': { model: 'Patient', filter: byId(), fields: only('status') },
    'patients.addGuardian': { model: 'Patient', filter: byId(), pick: guardians, fields: allKeys },
    'patients.updateGuardian': { model: 'Patient', filter: byId(), pick: guardians, fields: allKeys },
    'patients.removeGuardian': { model: 'Patient', filter: byId(), pick: guardians, fields: allKeys },
    'reminders.setOptOut': { model: 'Patient', filter: (r) => byId('patientId')(r), fields: only('remindersOptOut') },

    'chart.setChartType': { model: 'DentalRecord', filter: byPatient, fields: only('chartType') },
    'chart.updateTooth': {
        model: 'DentalRecord',
        filter: byPatient,
        pick: (doc, r) => teeth([Number(r.body.toothNumber)])(doc),
        fields: allKeys,
    },
    'chart.updateMultipleTeeth': {
        model: 'DentalRecord',
        filter: byPatient,
        pick: (doc, r) => teeth(((r.body.teeth as any[]) ?? []).map((t) => Number(t?.toothNumber)))(doc),
        fields: allKeys,
    },

    'appointments.update': { model: 'Appointment', filter: byId() },
    'appointments.updateStatus': { model: 'Appointment', filter: byId(), fields: only('status') },
    'appointments.cancel': { model: 'Appointment', filter: byId(), fields: only('status') },

    'billing.setFiscalNumber': { model: 'Payment', filter: byId(), fields: only('fiscalNumber') },
    'billing.updateInvoice': { model: 'Invoice', filter: byId(), pick: invoice, extra: ['totalAmount'] },
    // These answer with the payment, not the invoice: the invoice gives the patient and what changed on it.
    'billing.issueInvoice': { model: 'Invoice', filter: byId(), fields: only('status') },
    'billing.cancelInvoice': { model: 'Invoice', filter: byId(), fields: only('status') },
    'billing.addPayment': { model: 'Invoice', filter: byId(), pick: invoice, fields: only('paidAmount', 'status') },
    'billing.voidPayment': { model: 'Invoice', filter: byId(), pick: invoice, fields: only('paidAmount', 'status') },
    'billing.applyCredit': { model: 'Invoice', filter: byId(), pick: invoice, fields: only('paidAmount', 'status') },

    'chart.eruptTooth': { model: 'DentalRecord', filter: byPatient, pick: (doc, r) => onChart([Number(r.body.toothNumber)])(doc), fields: allKeys },
    'chart.uneruptTooth': { model: 'DentalRecord', filter: byPatient, pick: (doc, r) => onChart([Number(r.body.toothNumber)])(doc), fields: allKeys },

    'perio.update': { model: 'PerioExam', filter: byId(), extra: [] },
    'perio.saveTooth': { model: 'PerioExam', filter: byId(), pick: perioTooth, fields: allKeys },
    'perio.remove': { model: 'PerioExam', filter: byId(), fields: only() },

    'documents.update': { model: 'PatientDocument', filter: byId() },
    'documents.remove': { model: 'PatientDocument', filter: byId(), fields: only() },
    'documents.file': { model: 'PatientDocument', filter: byId(), fields: only() },

    'staff.update': { model: 'UserProfile', filter: byId(), pick: staffProfile },
    'staff.setStatus': { model: 'UserProfile', filter: byId(), fields: only('isActive') },
    'staff.updateAvailability': { model: 'UserProfile', filter: byId(), pick: staffProfile },

    'clinic.updateCurrent': { model: 'Clinic', filter: clinic },
    'clinic.updateWorkingHours': { model: 'Clinic', filter: clinic },
    'clinic.updateSettings': { model: 'Clinic', filter: clinic },

    'catalog.update': { model: 'Treatment', filter: byId() },
    'catalog.deactivate': { model: 'Treatment', filter: byId(), fields: only('isActive') },
    'catalog.reactivate': { model: 'Treatment', filter: byId(), fields: only('isActive') },

    'schedule.updateRoom': { model: 'TreatmentRoom', filter: byId() },
    'schedule.deactivateRoom': { model: 'TreatmentRoom', filter: byId(), fields: only('isActive') },
    'settings.updateTemplate': { model: 'NotificationTemplate', filter: byId() },
    'reminders.updateSettings': { model: 'ReminderSettings', filter: (r) => ({ clinicId: r.clinicId }) },
};
