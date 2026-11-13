/** Turning records into comparable, storable snapshots and listing what changed (F7). */

export interface FieldChange {
    field: string;
    from?: unknown;
    to?: unknown;
    masked?: boolean;
}

/** Secrets and pictures: only "changed" is recorded, never the value. */
const MASKED = /password|token|secret|apikey|api_key|authToken|photo|avatar|signature/i;
const MAX_VALUE = 2000;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isObjectId(v) && !Buffer.isBuffer(v);

function isObjectId(v: unknown): boolean {
    return !!v && typeof v === 'object' && typeof (v as { toHexString?: unknown }).toHexString === 'function';
}

/**
 * A JSON-safe copy: ids as strings, dates as ISO strings, sub-document `_id`s
 * and timestamps dropped (they change on every rewrite and would show up as
 * false changes).
 */
export function snapshot(value: unknown, depth = 0): unknown {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return value.toISOString();
    if (isObjectId(value)) return (value as { toHexString(): string }).toHexString();
    if (Buffer.isBuffer(value)) return '[binary]';
    if (Array.isArray(value)) return value.map((v) => snapshot(v, depth + 1));
    if (isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === '_id' && depth > 0) continue;
            if (k === 'createdAt' || k === 'updatedAt' || k === '__v') continue;
            const s = snapshot(v, depth + 1);
            if (s !== null && !(Array.isArray(s) && !s.length && depth > 0)) out[k] = s;
        }
        return out;
    }
    return value;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Long text and big arrays are cut so one entry stays small. */
const capped = (v: unknown) => {
    if (v === null || v === undefined) return null;
    const json = JSON.stringify(v);
    return json.length > MAX_VALUE ? `${json.slice(0, MAX_VALUE)}…` : v;
};

/**
 * What changed between two snapshots, limited to `fields`. A field whose value
 * is an object on either side (address, medical history…) is compared one
 * level down, so the entry says `medicalHistory.allergies`, not "medical
 * history changed".
 */
export function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null, fields: string[]): FieldChange[] {
    const b = (snapshot(before ?? {}) ?? {}) as Record<string, unknown>;
    const a = (snapshot(after ?? {}) ?? {}) as Record<string, unknown>;
    const changes: FieldChange[] = [];
    const seen = new Set<string>();

    const add = (field: string, from: unknown, to: unknown) => {
        if (seen.has(field) || same(from, to)) return;
        seen.add(field);
        if (MASKED.test(field)) changes.push({ field, masked: true });
        else changes.push({ field, from: capped(from), to: capped(to) });
    };

    for (const field of fields) {
        const from = b[field];
        const to = a[field];
        if (isPlainObject(from) || isPlainObject(to)) {
            const f = (isPlainObject(from) ? from : {}) as Record<string, unknown>;
            const t = (isPlainObject(to) ? to : {}) as Record<string, unknown>;
            for (const key of Array.from(new Set([...Object.keys(f), ...Object.keys(t)]))) add(`${field}.${key}`, f[key], t[key]);
        } else {
            add(field, from, to);
        }
    }
    return changes;
}

/**
 * A few identifying values from the request body and the response; never
 * secrets. Not the record's status from the response: it is usually unchanged
 * noise, and a status that did change is in the changes.
 */
const BODY_DETAILS = ['relationship', 'reason', 'note', 'voidReason', 'cancelReason', 'status', 'kind', 'toothNumber', 'role', 'email', 'method', 'amount', 'date'];
const RESPONSE_DETAILS = [
    'invoiceNumber',
    'amount',
    'totalAmount',
    'currency',
    'method',
    'title',
    'name',
    'firstName',
    'lastName',
    'role',
    'kind',
    'startTime',
    'treatmentName',
    'toothNumber',
    'counted',
    'difference',
];

export function pickDetails(body: unknown, response: unknown): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    const take = (src: unknown, keys: string[]) => {
        if (!isPlainObject(src)) return;
        for (const k of keys) {
            const v = snapshot(src[k], 1);
            if (v === null || isPlainObject(v) || Array.isArray(v)) continue;
            out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
        }
    };
    take(response, RESPONSE_DETAILS);
    take(body, BODY_DETAILS);
    if (Array.isArray(response)) out.count = response.length;
    return Object.keys(out).length ? out : undefined;
}
