import { TFunction } from 'i18next';
import { lastDayOf } from './platform';
import i18n from '../locales/i18n';
import { AuditEntry, PaymentMethod, SurfaceStatus, ToothStatus, ToothSurface } from '../types';
import { statusKey } from './appointments';
import { paymentMethodKey } from './billing';
import { surfaceKey, surfaceStatusKey, toothStatusKey } from './dental';
import { formatCurrency, formatDate, formatDateTime } from './formatters';
import { roleTranslationKey } from '../pages/staff/staffForm';

export const AUDIT_AREAS = [
    'patients',
    'chart',
    'perio',
    'plans',
    'appointments',
    'billing',
    'documents',
    'staff',
    'clinic',
    'catalog',
    'schedule',
    'settings',
    'reminders',
    'auth',
    'commission',
    // F13: what DentFlow did to the clinic, and what support looked at.
    'platform',
    'support',
] as const;

const humanize = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();

/** "Changed patient details", "Took a payment"… An action without its own text reads "Area · action". */
export const eventLabel = (t: TFunction, event: string) => {
    const [area, action] = event.split('.');
    return t(`audit.events.${event}`, { defaultValue: `${t(`audit.areas.${area}`, { defaultValue: area })} · ${humanize(action ?? '')}` });
};

const fieldName = (t: TFunction, key: string) => t(`audit.fields.${key}`, { defaultValue: humanize(key) });

/** `36.status` → "Tooth 36 · Status"; `medicalHistory.allergies` → "Medical history · Allergies". */
export const fieldLabel = (t: TFunction, field: string) => {
    const [head, ...rest] = field.split('.');
    if (/^\d{2}$/.test(head)) return `${t('dental.tooth')} ${head} · ${fieldName(t, rest.join('.'))}`;
    // One guardian (F8), keyed by its id.
    if (head === 'guardians') return fieldName(t, 'guardian');
    return [head, ...rest].map((k) => fieldName(t, k)).join(' · ');
};

const first = (t: TFunction, keys: string[], fallback: string) => {
    const key = keys.find((k) => i18n.exists(k));
    return key ? String(t(key)) : fallback;
};

/** An enum value in the user's language, using the texts the rest of the app already has. */
const enumValue = (t: TFunction, area: string, field: string, v: string) => {
    const last = field.split('.').pop()!;
    if (/^\d{2}\.status$/.test(field)) return t(toothStatusKey(v as ToothStatus));
    if (/^\d{2}\.surfaces$/.test(field) && v.includes(':')) {
        const [surface, status] = v.split(':');
        return `${t(surfaceKey(surface as ToothSurface))}: ${t(surfaceStatusKey(status as SurfaceStatus))}`;
    }
    if (last === 'role') return t(`staff.${roleTranslationKey(v)}`);
    if (last === 'method') return t(paymentMethodKey(v as PaymentMethod));
    if (last === 'kind') return first(t, [`documents.kinds.${v}`], v);
    if (last === 'relationship') return first(t, [`family.relationships.${v}`], v);
    if (last === 'language') return first(t, [`reminders.languages.${v}`], v);
    if (last === 'gender') return first(t, [`patients.${v}`], v);
    if (last === 'status' || last === 'reason') {
        const byArea: Record<string, string[]> = {
            patients: [`patients.${v}`],
            appointments: [statusKey(v), `appointments.cancelReasons.${v}`],
            billing: [`billing.${v}`],
            plans: [`plans.statuses.${v}`],
            auth: [`audit.reasons.${v}`],
            platform: [`subscription.status.${v}`],
        };
        return first(t, [...(byArea[area] ?? []), `common.${v}`], v);
    }
    return v;
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A stored value as the user would say it: dates in their format, enums translated, lists joined. */
export const formatValue = (t: TFunction, entry: Pick<AuditEntry, 'area'>, field: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return t(value ? 'common.yes' : 'common.no');
    if (typeof value === 'number') return value.toLocaleString(i18n.language);
    if (typeof value === 'string') {
        // A guardian (F8): "mother · primary · patient:<id>" or "… · Name +374…".
        if (field.startsWith('guardians.')) {
            return value
                .split(' · ')
                .map((part) =>
                    part === 'primary'
                        ? String(t('family.main'))
                        : part.startsWith('patient:')
                          ? String(t('family.isPatient'))
                          : i18n.exists(`family.relationships.${part}`)
                            ? String(t(`family.relationships.${part}`))
                            : part,
                )
                .join(' · ');
        }
        // F13: the end of a subscription is stored as the moment access stops; show the last day.
        if (field === 'expiresAt' && ISO.test(value)) return formatDate(lastDayOf(value), 'dd.MM.yyyy', i18n.language);
        if (ISO.test(value)) {
            return value.endsWith('T00:00:00.000Z') ? formatDate(value, 'dd.MM.yyyy', i18n.language) : formatDateTime(value, i18n.language);
        }
        return enumValue(t, entry.area, field, value);
    }
    if (Array.isArray(value)) {
        if (!value.length) return '—';
        return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : formatValue(t, entry, field, v))).join(', ');
    }
    return JSON.stringify(value);
};

/** The identifying values worth showing next to the action, in a fixed order. */
const DETAIL_ORDER = ['section', 'relationship', 'invoiceNumber', 'title', 'firstName', 'lastName', 'email', 'amount', 'totalAmount', 'method', 'status', 'kind', 'startTime', 'reason', 'note', 'counted', 'difference', 'count'];

export const detailItems = (t: TFunction, entry: AuditEntry): string[] => {
    const d = entry.details ?? {};
    const currency = typeof d.currency === 'string' ? d.currency : undefined;
    const out: string[] = [];
    const name = [d.firstName, d.lastName].filter(Boolean).join(' ');
    for (const key of DETAIL_ORDER) {
        const v = d[key];
        if (v === undefined || v === null || v === '' || key === 'lastName') continue;
        if (key === 'firstName') {
            if (name && !entry.patientId) out.push(name);
            continue;
        }
        // The status it moved to already shows under the changes.
        if (key === 'status' && entry.changes?.some((c) => c.field === 'status' || c.field.endsWith('.status'))) continue;
        if (key === 'toothNumber' && entry.changes?.length) continue;
        if (['amount', 'totalAmount', 'counted', 'difference'].includes(key) && typeof v === 'number') {
            out.push(`${fieldName(t, key)}: ${formatCurrency(v, currency)}`);
        } else if (key === 'section') {
            // F13: which part of the app a support view looked at.
            out.push(first(t, [`audit.areas.${v}`], String(v)));
        } else if (key === 'invoiceNumber' || key === 'title' || key === 'email') {
            out.push(String(v));
        } else {
            out.push(`${fieldName(t, key)}: ${formatValue(t, entry, key, v)}`);
        }
    }
    return out;
};

/** The person's role in their language. */
export const roleLabel = (t: TFunction, role: string) => t(`staff.${roleTranslationKey(role)}`);

/** Login failures carry why; the rest of `auth` events need nothing more. */
export const isFailure = (entry: AuditEntry) => entry.event === 'auth.loginFailed';
