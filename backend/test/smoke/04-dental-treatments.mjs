const API = process.env.API_URL || 'http://127.0.0.1:8000/api';
let pass = 0, fail = 0; const out = [];
async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json, data: json?.data };
}
const check = (n, c, d) => { if (c) { pass++; out.push('PASS ' + n); } else { fail++; out.push(`FAIL ${n} :: ${JSON.stringify(d)?.slice(0, 280)}`); } };
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).data?.accessToken;
const u = Date.now().toString(36);

// Fresh clinic with a dentist, a receptionist and two patients
let r = await call('POST', '/auth/register', { body: { clinicName: `Chart ${u}`, email: `owner-${u}@c.am`, password: 'ownerpass1', firstName: 'Own', lastName: 'Er' } });
const T = r.data.accessToken;
const mkStaff = async (role) => {
  const email = `${role}-${u}@c.am`;
  await call('POST', '/users', { token: T, body: { firstName: role, lastName: 'S', email, password: 'staffpass1', role } });
  return login(email, 'staffpass1');
};
const D = await mkStaff('dentist'), R = await mkStaff('receptionist');
const mkPatient = async (n, k) => (await call('POST', '/patients', { token: T, body: { firstName: n, lastName: 'P', dateOfBirth: '1990-01-01', gender: 'female', phone: '+3749' + String(Date.now() + k).slice(-7) } })).data;
const p = await mkPatient('Adult', 1), p2 = await mkPatient('Race', 2);
const chartUrl = `/dental-records/${p._id}`;

// ── Chart: FDI, per-surface, roles ─────────────────────────────────────────
r = await call('GET', `${chartUrl}/chart`, { token: R });
const nums = r.data?.teeth?.map((t) => t.toothNumber) ?? [];
check('new chart: 32 FDI teeth 11..48', r.status === 200 && nums.length === 32 && nums.includes(11) && nums.includes(48) && !nums.includes(1), nums);
check('chart response hides archive', r.data?.archivedCharts === undefined && Array.isArray(r.data?.archivedChartTypes), Object.keys(r.data ?? {}));

r = await call('PATCH', `${chartUrl}/tooth`, { token: D, body: { toothNumber: 16, status: 'decayed', surfaces: [{ surface: 'mesial', status: 'decayed' }, { surface: 'occlusal', status: 'filled' }] } });
const t16 = r.data?.teeth?.find((t) => t.toothNumber === 16);
check('mesial decayed + occlusal filled on one tooth', r.status === 200 && t16?.surfaces?.length === 2 && t16.surfaces.some((s) => s.surface === 'mesial' && s.status === 'decayed'), t16);
r = await call('PATCH', `${chartUrl}/tooth`, { token: D, body: { toothNumber: 16, surfaces: [{ surface: 'mesial', status: 'decayed' }, { surface: 'mesial', status: 'filled' }] } });
check('same surface twice -> duplicateSurface', r.status === 400 && r.body.code === 'duplicateSurface', r.body);
r = await call('PATCH', `${chartUrl}/tooth`, { token: D, body: { toothNumber: 16, surfaces: [{ surface: 'mesial', status: 'banana' }] } });
check('unknown surface status -> 400', r.status === 400, r.body);
r = await call('PATCH', `${chartUrl}/tooth`, { token: D, body: { toothNumber: 1, status: 'filled' } });
check('Universal number 1 -> toothNotInChart', r.status === 404 && r.body.code === 'toothNotInChart', r.body);
r = await call('PATCH', `${chartUrl}/tooth`, { token: R, body: { toothNumber: 11, status: 'filled' } });
check('receptionist cannot edit chart', r.status === 403, r.body);
r = await call('PATCH', `${chartUrl}/chart-type`, { token: R, body: { chartType: 'pediatric' } });
check('receptionist cannot switch chart type', r.status === 403, r.body);
r = await call('GET', `${chartUrl}/chart?chartType=banana`, { token: D });
check('chartType query validated', r.status === 400, r.body);

// ── Chart type snapshot (D6) ────────────────────────────────────────────────
r = await call('PATCH', `${chartUrl}/chart-type`, { token: D, body: { chartType: 'pediatric' } });
const kid = r.data?.teeth?.map((t) => t.toothNumber) ?? [];
check('pediatric: 20 FDI primary teeth', r.status === 200 && kid.length === 20 && kid.includes(55) && kid.includes(85), kid);
check('adult chart archived', r.data?.archivedChartTypes?.join() === 'adult', r.data?.archivedChartTypes);
r = await call('PATCH', `${chartUrl}/chart-type`, { token: D, body: { chartType: 'adult' } });
const back16 = r.data?.teeth?.find((t) => t.toothNumber === 16);
check('switching back restores the adult chart', back16?.status === 'decayed' && back16?.surfaces?.length === 2 && back16?.history?.length === 1, back16);
check('pediatric kept in archive', r.data?.archivedChartTypes?.join() === 'pediatric', r.data?.archivedChartTypes);

// ── Treatment entries ──────────────────────────────────────────────────────
const entryUrl = `${chartUrl}/treatment-entry`;
r = await call('POST', entryUrl, { token: D, body: { teeth: [16], treatmentName: 'Filling', status: 'planned', resultStatus: 'filled', surfaces: ['mesial'] } });
const planned = r.data;
check('planned entry created', r.status === 201 && planned?.status === 'planned' && planned?.createdBy?.firstName === 'dentist', r.body);
r = await call('GET', `${chartUrl}/chart`, { token: D });
check('planned entry leaves the chart alone', r.data.teeth.find((t) => t.toothNumber === 16).status === 'decayed', r.data.teeth.find((t) => t.toothNumber === 16));
r = await call('PATCH', `${entryUrl}/${planned._id}/complete`, { token: D, body: {} });
check('complete planned entry', r.status === 200 && r.data?.status === 'done' && r.data?.completedBy?.firstName === 'dentist', r.body);
r = await call('GET', `${chartUrl}/chart`, { token: D });
const done16 = r.data.teeth.find((t) => t.toothNumber === 16);
check('done filling: mesial now filled, tooth filled', done16.status === 'filled' && done16.surfaces.every((s) => s.status === 'filled') && done16.surfaces.length === 2, done16);
check('tooth history links the entry', done16.history.at(-1)?.treatmentEntryId === planned._id, done16.history.at(-1));
r = await call('PATCH', `${entryUrl}/${planned._id}/complete`, { token: D, body: {} });
check('complete twice -> treatmentEntryAlreadyDone', r.status === 400 && r.body.code === 'treatmentEntryAlreadyDone', r.body);

r = await call('POST', entryUrl, { token: D, body: { treatmentName: 'Examination' } });
check('entry without a tooth (exam)', r.status === 201 && r.data?.teeth?.length === 0 && r.data?.status === 'done', r.body);
r = await call('POST', entryUrl, { token: D, body: { teeth: [19], treatmentName: 'X' } });
check('non-FDI tooth -> invalidTooth', r.status === 400 && r.body.code === 'invalidTooth', r.body);
r = await call('POST', entryUrl, { token: R, body: { treatmentName: 'X' } });
check('receptionist cannot record treatment', r.status === 403, r.body);
r = await call('POST', entryUrl, { token: D, body: { teeth: [14, 15, 16], treatmentName: 'Bridge', status: 'planned', resultStatus: 'bridge' } });
const bridge = r.data;
check('multi-tooth entry (bridge)', r.status === 201 && bridge?.teeth?.join() === '14,15,16', r.body);

// Catalogue default: extraction makes the tooth missing
const cat = (await call('GET', '/treatments?search=D7140', { token: D })).data;
const extraction = cat?.data?.[0];
check('catalogue extraction has toothStatus=missing', extraction?.toothStatus === 'missing', extraction);
r = await call('POST', entryUrl, { token: D, body: { teeth: [38], treatmentName: extraction?.name, treatmentId: extraction?._id } });
check('extraction entry gets resultStatus from catalogue', r.data?.resultStatus === 'missing', r.body);
r = await call('GET', `${chartUrl}/chart`, { token: D });
check('tooth 38 is now missing', r.data.teeth.find((t) => t.toothNumber === 38).status === 'missing', r.data.teeth.find((t) => t.toothNumber === 38));

// History filters + void
r = await call('GET', `${chartUrl}/treatment-history?toothNumber=15`, { token: R });
check('history by tooth finds the bridge', r.status === 200 && r.data?.data?.length === 1 && r.data.data[0]._id === bridge._id, r.data);
r = await call('GET', `${chartUrl}/treatment-history?status=planned`, { token: D });
check('history by status', r.data?.pagination?.total === 1, r.data?.pagination);
r = await call('PATCH', `${entryUrl}/${bridge._id}/void`, { token: D, body: { reason: 'no' } });
check('void reason too short -> 400', r.status === 400, r.body);
r = await call('PATCH', `${entryUrl}/${bridge._id}/void`, { token: D, body: { reason: 'Wrong patient' } });
check('void entry', r.status === 200 && r.data?.voidedAt && r.data?.voidedBy?.firstName === 'dentist' && r.data?.voidReason === 'Wrong patient', r.body);
r = await call('PATCH', `${entryUrl}/${bridge._id}/void`, { token: D, body: { reason: 'Again please' } });
check('void twice -> treatmentEntryVoided', r.status === 400 && r.body.code === 'treatmentEntryVoided', r.body);
r = await call('PATCH', `${entryUrl}/${bridge._id}/complete`, { token: D, body: {} });
check('complete voided -> treatmentEntryVoided', r.status === 400 && r.body.code === 'treatmentEntryVoided', r.body);
r = await call('GET', `${chartUrl}/treatment-history`, { token: D });
const visible = r.data?.pagination?.total;
r = await call('GET', `${chartUrl}/treatment-history?includeVoided=true`, { token: D });
check('voided hidden unless asked', visible === 3 && r.data?.pagination?.total === 4, { visible, all: r.data?.pagination?.total });

r = await call('GET', `${chartUrl}/tooth/16/history`, { token: R });
check('tooth history: who changed it', r.status === 200 && r.data?.statusHistory?.[0]?.changedBy?.firstName === 'dentist' && r.data?.treatments?.length === 1, r.data?.statusHistory?.[0]);
r = await call('GET', `${chartUrl}/tooth/9/history`, { token: R });
check('tooth history rejects non-FDI', r.status === 400 && r.body.code === 'invalidTooth', r.body);
r = await call('GET', `${chartUrl}/summary`, { token: R });
check('summary counts', r.data?.missingCount === 1 && r.data?.treatedCount === 1 && r.data?.totalTreatmentEntries === 3, r.data);

// ── Concurrency ────────────────────────────────────────────────────────────
const chartUrl2 = `/dental-records/${p2._id}`;
const firstOpens = await Promise.all([1, 2, 3, 4, 5].map(() => call('GET', `${chartUrl2}/chart`, { token: D })));
check('5 parallel first opens -> one chart, no 500', firstOpens.every((x) => x.status === 200) && new Set(firstOpens.map((x) => x.data._id)).size === 1, firstOpens.map((x) => x.status));
const teeth = [11, 12, 13, 21, 22, 23];
const edits = await Promise.all(teeth.map((n) => call('PATCH', `${chartUrl2}/tooth`, { token: D, body: { toothNumber: n, status: 'crown' } })));
r = await call('GET', `${chartUrl2}/chart`, { token: D });
const crowned = r.data.teeth.filter((t) => t.status === 'crown').length;
check('6 parallel edits of different teeth all kept', edits.every((x) => x.status === 200 || x.body?.code === 'chartChanged') && crowned === edits.filter((x) => x.status === 200).length && crowned >= 4, { statuses: edits.map((x) => x.status), crowned });

// ── Catalogue ─────────────────────────────────────────────────────────────
r = await call('GET', '/treatments', { token: R });
check('catalogue total is real (seeded 20)', r.data?.pagination?.total === 20 && r.data?.data?.length === 20, r.data?.pagination);
r = await call('GET', '/treatments?limit=500', { token: R });
check('limit > 100 -> 400', r.status === 400, r.body);
r = await call('GET', '/treatments?search=(((', { token: R });
check('regex characters in search are safe', r.status === 200, r.body);
r = await call('POST', '/treatments', { token: D, body: { name: 'Dentist item', category: 'general' } });
check('dentist cannot edit catalogue (D5)', r.status === 403, r.body);
r = await call('POST', '/treatments', { token: T, body: { name: 'Dup', category: 'general', code: 'd0150' } });
check('code unique per clinic, case-insensitive', r.status === 409 && r.body.code === 'treatmentCodeTaken', r.body);
r = await call('POST', '/treatments', { token: T, body: { name: 'Custom', nameHy: 'Հայ', description: 'desc', category: 'general', code: 'x-1', toothStatus: 'filled' } });
const custom = r.data;
check('create custom: code upper-cased', r.status === 201 && custom?.code === 'X-1' && custom?.toothStatus === 'filled', r.body);
r = await call('PATCH', `/treatments/${custom._id}`, { token: T, body: { nameHy: '', description: '', code: '', toothStatus: '' } });
check('empty optional fields clear them', r.status === 200 && r.data.nameHy === undefined && r.data.description === undefined && r.data.code === undefined && r.data.toothStatus === undefined, r.data);
r = await call('POST', '/treatments', { token: T, body: { name: 'No code 2', category: 'general' } });
check('several items without a code allowed', r.status === 201, r.body);
r = await call('PATCH', `/treatments/${custom._id}`, { token: T, body: { code: 'D0150' } });
check('update to a taken code -> 409', r.status === 409 && r.body.code === 'treatmentCodeTaken', r.body);
r = await call('DELETE', `/treatments/${custom._id}`, { token: T });
check('deactivate', r.status === 200 && r.data.isActive === false, r.body);
r = await call('GET', '/treatments?isActive=true&limit=100', { token: R });
check('active filter hides it', !r.data.data.some((t) => t._id === custom._id), r.data.pagination);
r = await call('PATCH', `/treatments/${custom._id}/reactivate`, { token: T });
check('reactivate', r.status === 200 && r.data.isActive === true, r.body);
r = await call('POST', '/treatments/seed-defaults', { token: T });
check('seed-defaults skips a non-empty catalogue', r.status === 201 && r.data.created === 0, r.body);

// ── Tenancy ───────────────────────────────────────────────────────────────
r = await call('POST', '/auth/register', { body: { clinicName: `Other ${u}`, email: `other-${u}@c.am`, password: 'ownerpass1', firstName: 'Ot', lastName: 'Her' } });
const OT = r.data.accessToken;
r = await call('GET', `${chartUrl}/chart`, { token: OT });
check('other clinic cannot open the chart', r.status === 404, r.body);
const otherItem = (await call('GET', '/treatments?limit=1', { token: OT })).data.data[0];
r = await call('POST', entryUrl, { token: D, body: { treatmentName: 'X', treatmentId: otherItem._id } });
check("other clinic's treatment id -> 404", r.status === 404 && r.body.code === 'treatmentNotFound', r.body);

console.log(out.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
