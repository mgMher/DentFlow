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

// Clinic calendar (Asia/Yerevan, the default)
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yerevan', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = ymd(new Date());
const monthStart = `${today.slice(0, 7)}-01`;
const shift = (date, days) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + days)).toISOString().slice(0, 10);
const yesterday = shift(today, -1);

// Fresh AMD clinic: owner, receptionist, assistant, two dentists, two patients
let r = await call('POST', '/auth/register', { body: { clinicName: `Rep ${u}`, email: `owner-${u}@r.am`, password: 'ownerpass1', firstName: 'Own', lastName: 'Er' } });
const T = r.data.accessToken;
const mkStaff = async (role, firstName = role) => {
  const email = `${firstName}-${u}@r.am`;
  const user = (await call('POST', '/users', { token: T, body: { firstName, lastName: 'S', email, password: 'staffpass1', role } })).data;
  return { user, token: await login(email, 'staffpass1') };
};
const R = (await mkStaff('receptionist')).token, A = (await mkStaff('assistant')).token;
const dentist = await mkStaff('dentist', 'dOne'), dentist2 = await mkStaff('dentist', 'dTwo');
const D = dentist.token;
const mkPatient = async (n, k) => (await call('POST', '/patients', { token: R, body: { firstName: n, lastName: `Rep${u}`, dateOfBirth: '1990-01-01', gender: k === 1 ? 'female' : 'male', phone: '+3749' + String(Date.now() + k).slice(-7) } })).data;
const p = await mkPatient('Anna', 1), p2 = await mkPatient('Bob', 2);

// ── Dashboard for every role (it is everyone's landing page) ──────────────
for (const [name, token] of [['admin', T], ['receptionist', R], ['dentist', D], ['assistant', A]]) {
  r = await call('GET', '/reports/dashboard', { token });
  check(`dashboard opens for ${name}`, r.status === 200 && typeof r.data?.today?.appointments === 'number' && r.data.activePatients === 2, r.body);
}
r = await call('GET', '/reports/dashboard', { token: R });
check('receptionist: open invoices, no revenue', !!r.data.invoices && r.data.monthRevenue === undefined, r.data);
r = await call('GET', '/reports/dashboard', { token: A });
check('assistant: no invoices, no revenue', r.data.invoices === undefined && r.data.monthRevenue === undefined, r.data);

// ── Data: one catalogue treatment done by dOne, billed and paid ───────────
const filling = (await call('POST', '/treatments', { token: T, body: { name: 'Composite filling', category: 'general', code: `CF${u}`.slice(0, 20), price: { amount: 20000, currency: 'AMD' } } })).data;
r = await call('POST', `/dental-records/${p._id}/treatment-entry`, { token: D, body: { teeth: [16], treatmentId: filling._id, treatmentName: 'Composite filling' } });
const entry = r.data;
check('dentist records a done treatment', r.status === 201 && entry?.status === 'done', r.body);
r = await call('POST', '/billing/invoices', { token: R, body: { patientId: p._id, issue: true, items: [{ description: 'Composite filling', unitPrice: 20000, treatmentId: filling._id, treatmentEntryId: entry._id }] } });
const i1 = r.data;
// A manual line with no treatment or dentist
r = await call('POST', '/billing/invoices', { token: R, body: { patientId: p2._id, issue: true, items: [{ description: 'Consultation', unitPrice: 5000 }] } });
const i2 = r.data;
check('two issued invoices (20000 + 5000)', i1?.status === 'issued' && i2?.status === 'issued', [i1?.status, i2?.status]);
// 00:30 Yerevan today = 20:30 UTC yesterday: must count for today, not yesterday
r = await call('POST', `/billing/invoices/${i1._id}/payments`, { token: R, body: { method: 'cash', amount: 15000, date: `${today}T00:30:00+04:00` } });
check('cash 15000 at 00:30 clinic time', r.status === 201, r.body);
r = await call('POST', `/billing/invoices/${i2._id}/payments`, { token: R, body: { method: 'card', amount: 5000 } });
r = await call('POST', `/billing/invoices/${i1._id}/payments`, { token: R, body: { method: 'cash', amount: 2000 } });
const refunded = r.data?.payment;
r = await call('PATCH', `/billing/invoices/${i1._id}/payments/${refunded._id}/void`, { token: T, body: { type: 'refund', reason: 'Returned' } });
check('a 2000 payment refunded', r.status === 200, r.body);

// ── Revenue (admin only, one definition: collected, not voided) ───────────
r = await call('GET', '/reports/revenue', { token: R });
check('revenue: receptionist 403', r.status === 403, r.status);
r = await call('GET', '/reports/revenue', { token: D });
check('revenue: dentist 403', r.status === 403, r.status);
r = await call('GET', `/reports/revenue?startDate=${monthStart}&endDate=${today}`, { token: T });
const rev = r.data;
check('collected 20000 (refund excluded), AMD', r.status === 200 && rev.collected === 20000 && rev.paymentCount === 2 && rev.currency === 'AMD', rev);
check('by method: cash 15000, card 5000', rev?.byMethod?.find((m) => m.method === 'cash')?.total === 15000 && rev.byMethod.find((m) => m.method === 'card')?.total === 5000, rev?.byMethod);
check('invoiced 25000 in 2 invoices', rev?.invoiced === 25000 && rev.invoiceCount === 2, rev);
check('outstanding 5000 on 1 invoice', rev?.outstanding?.balance === 5000 && rev.outstanding.invoices === 1 && rev.outstanding.overdue === 0, rev?.outstanding);
const days = rev?.byPeriod ?? [];
check('every day of the range listed, zeros included', days.length === Number(today.slice(8, 10)) && days[0].period === monthStart && days.at(-1).period === today, days.map((d) => d.period));
check('00:30 payment lands on today (clinic timezone)', days.at(-1)?.total === 20000 && (days.length < 2 || days.at(-2).total === 0), days.slice(-2));
r = await call('GET', `/reports/revenue?startDate=${today}&endDate=${today}`, { token: T });
check('single-day range: end date included', r.data?.collected === 20000, r.data?.collected);
r = await call('GET', `/reports/revenue?startDate=${yesterday}&endDate=${yesterday}`, { token: T });
check('yesterday: nothing', r.data?.collected === 0, r.data?.collected);
r = await call('GET', `/reports/revenue?startDate=${shift(today, -60)}&endDate=${today}&groupBy=month`, { token: T });
check('groupBy=month: 3 periods starting on the 1st', r.data?.byPeriod?.length === 3 && r.data.byPeriod.every((x) => x.period.endsWith('-01')) && r.data.collected === 20000, r.data?.byPeriod);
r = await call('GET', `/reports/revenue?startDate=${shift(today, -20)}&endDate=${today}&groupBy=week`, { token: T });
check('groupBy=week: periods start on Mondays', r.data?.byPeriod?.every((x) => new Date(x.period + 'T00:00:00Z').getUTCDay() === 1), r.data?.byPeriod);
r = await call('GET', '/reports/revenue', { token: T });
check('no dates: this month to today', r.status === 200 && r.data.startDate === monthStart && r.data.endDate === today, r.data && [r.data.startDate, r.data.endDate]);

// ── Validation ────────────────────────────────────────────────────────────
r = await call('GET', `/reports/revenue?startDate=${today}&endDate=${yesterday}`, { token: T });
check('start after end -> invalidDateRange', r.status === 400 && r.body.code === 'invalidDateRange', r.body);
r = await call('GET', '/reports/revenue?startDate=10/01/2026', { token: T });
check('bad date format -> 400', r.status === 400, r.body);
r = await call('GET', '/reports/revenue?groupBy=year', { token: T });
check('bad groupBy -> 400', r.status === 400, r.body);
r = await call('GET', '/reports/revenue?startDate=2020-01-01&endDate=2026-01-01&groupBy=day', { token: T });
check('6 years by day -> reportRangeTooLong', r.status === 400 && r.body.code === 'reportRangeTooLong', r.body);
r = await call('GET', '/reports/appointments?startDate=2026-13-01', { token: T });
check('month 13 -> 400', r.status === 400, r.body);

// ── Appointments ──────────────────────────────────────────────────────────
const at = (days, h) => new Date(Date.parse(`${shift(today, days)}T00:00:00+04:00`) + h * 3600000).toISOString();
const dOneId = dentist.user.authId ?? dentist.user._id;
const dTwoId = dentist2.user.authId ?? dentist2.user._id;
r = await call('POST', '/appointments', { token: R, body: { patientId: p._id, dentistId: dOneId, startTime: at(2, 10), endTime: at(2, 10.5) } });
const a1 = r.data;
await call('POST', '/appointments', { token: R, body: { patientId: p2._id, dentistId: dOneId, startTime: at(2, 11), endTime: at(2, 11.5) } });
r = await call('POST', '/appointments', { token: R, body: { patientId: p2._id, dentistId: dTwoId, startTime: at(3, 12), endTime: at(3, 12.5) } });
const a3 = r.data;
check('three bookings', !!a1?._id && !!a3?._id, r.body);
r = await call('PATCH', `/appointments/${a3._id}/cancel`, { token: R, body: { reason: 'patient_request' } });
const range = `startDate=${today}&endDate=${shift(today, 7)}`;
r = await call('GET', `/reports/appointments?${range}`, { token: T });
check('admin: 3 total, 2 scheduled, 1 cancelled', r.data?.total === 3 && r.data.byStatus.scheduled === 2 && r.data.cancelled === 1, r.data);
check('rates over appointments with an outcome (1 cancelled -> 100%)', r.data?.cancellationRate === 100 && r.data.completionRate === 0, r.data);
r = await call('GET', `/reports/appointments?${range}`, { token: D });
check('dentist: own appointments only (2)', r.data?.total === 2 && r.data.ownOnly === true && r.data.cancelled === 0, r.data);
r = await call('GET', `/reports/appointments?${range}`, { token: R });
check('appointments report: receptionist 403', r.status === 403, r.status);
r = await call('GET', `/reports/appointments?${range}`, { token: A });
check('appointments report: assistant 403', r.status === 403, r.status);

// ── Dentist performance ───────────────────────────────────────────────────
const wide = `startDate=${monthStart}&endDate=${shift(today, 7)}`;
r = await call('GET', `/reports/dentist-performance?${wide}`, { token: T });
const one = r.data?.rows?.find((x) => x.firstName === 'dOne'), two = r.data?.rows?.find((x) => x.firstName === 'dTwo');
check('admin: both dentists listed', r.status === 200 && !!one && !!two, r.data);
check('dOne: 2 appointments, 1 treatment, collected 15000', one?.appointments === 2 && one.treatmentsDone === 1 && one.collected === 15000, one);
check('dTwo: 1 cancelled, collected 0', two?.cancelled === 1 && two.collected === 0, two);
check('consultation with no dentist -> unassigned 5000; parts add up', r.data?.unassignedCollected === 5000 && one.collected + two.collected + r.data.unassignedCollected === 20000, r.data);
r = await call('GET', `/reports/dentist-performance?${wide}`, { token: D });
check('dentist: own row, no money', r.data?.rows?.length === 1 && r.data.rows[0].firstName === 'dOne' && r.data.rows[0].collected === undefined && r.data.unassignedCollected === undefined, r.data);

// ── Treatments ────────────────────────────────────────────────────────────
r = await call('GET', `/reports/treatments?${wide}`, { token: T });
const cf = r.data?.rows?.find((x) => x.treatmentId === filling._id);
const consult = r.data?.rows?.find((x) => x.name === 'Consultation');
check('filling: done 1, collected 15000, catalogue code', cf?.done === 1 && cf.collected === 15000 && cf.code === filling.code, cf);
check('manual line grouped by name: collected 5000, done 0', consult?.collected === 5000 && consult.done === 0, consult);
r = await call('GET', `/reports/treatments?${wide}`, { token: D });
check('dentist: own treatments, no money', r.data?.rows?.length === 1 && r.data.rows[0].done === 1 && r.data.rows[0].collected === undefined, r.data);

// ── Patients ──────────────────────────────────────────────────────────────
r = await call('GET', `/reports/patients?startDate=${monthStart}&endDate=${today}`, { token: T });
check('patients: 2 total, 2 active, 2 new (1 female, 1 male)', r.data?.total === 2 && r.data.active === 2 && r.data.newInRange === 2 && r.data.newByGender.female === 1, r.data);
r = await call('GET', `/reports/patients?startDate=${yesterday}&endDate=${yesterday}`, { token: T });
check('patients registered yesterday: 0', r.data?.newInRange === 0, r.data);

// ── Dashboard after activity ──────────────────────────────────────────────
r = await call('GET', '/reports/dashboard', { token: T });
const dash = r.data;
check('admin: month revenue 20000 AMD', dash?.monthRevenue?.amount === 20000 && dash.monthRevenue.currency === 'AMD', dash?.monthRevenue);
check('open invoices: 1 with 5000 outstanding', dash?.invoices?.open === 1 && dash.invoices.outstanding === 5000, dash?.invoices);
check('new patients this month: 2', dash?.newPatientsThisMonth === 2, dash?.newPatientsThisMonth);
check('upcoming: 2 (cancelled left out), populated', dash?.upcomingAppointments?.length === 2 && dash.upcomingAppointments[0].patientId?.firstName === 'Anna' && dash.upcomingAppointments[0].dentistId?.firstName === 'dOne', dash?.upcomingAppointments);
const types = new Set(dash?.recentActivity?.map((x) => x.type));
check('recent activity mixes payments, invoices, appointments', types.has('payment') && types.has('invoice') && types.has('appointment') && dash.recentActivity.length <= 8, [...types]);
check('activity is newest first, with who', dash?.recentActivity?.every((x, i, a) => i === 0 || a[i - 1].at >= x.at) && dash.recentActivity.find((x) => x.type === 'payment')?.by?.firstName === 'receptionist', dash?.recentActivity?.slice(0, 3));
r = await call('GET', '/reports/dashboard', { token: D });
check('dentist dashboard: own upcoming (2)', r.data?.upcomingAppointments?.length === 2 && r.data.ownAppointments === true, r.data?.upcomingAppointments?.length);
r = await call('GET', '/reports/dashboard', { token: A });
check('assistant activity: no money items', r.data?.recentActivity?.every((x) => x.type !== 'payment' && x.type !== 'invoice'), r.data?.recentActivity?.map((x) => x.type));

// ── Minor units: USD clinic ───────────────────────────────────────────────
r = await call('POST', '/auth/register', { body: { clinicName: `RepUSD ${u}`, email: `usd-${u}@r.am`, password: 'ownerpass1', firstName: 'Us', lastName: 'D' } });
const U = r.data.accessToken;
r = await call('PATCH', '/clinics/current', { token: U, body: { currency: 'USD' } });
check('clinic switched to USD', r.status === 200, r.body);
const up = (await call('POST', '/patients', { token: U, body: { firstName: 'Cent', lastName: 'Payer', dateOfBirth: '1990-01-01', gender: 'male', phone: '+3749' + String(Date.now() + 9).slice(-7) } })).data;
const ui = (await call('POST', '/billing/invoices', { token: U, body: { patientId: up._id, issue: true, items: [{ description: 'Cleaning', unitPrice: 10.25 }] } })).data;
await call('POST', `/billing/invoices/${ui._id}/payments`, { token: U, body: { method: 'cash', amount: 0.1 } });
await call('POST', `/billing/invoices/${ui._id}/payments`, { token: U, body: { method: 'cash', amount: 0.2 } });
r = await call('GET', '/reports/revenue', { token: U });
check('USD: 0.10 + 0.20 = 0.30 collected (cents divided back)', r.data?.collected === 0.3 && r.data.currency === 'USD' && r.data.outstanding.balance === 9.95, r.data);
r = await call('GET', '/reports/dashboard', { token: U });
check('USD dashboard: month revenue 0.3', r.data?.monthRevenue?.amount === 0.3, r.data?.monthRevenue);

// ── Tenancy ───────────────────────────────────────────────────────────────
r = await call('GET', '/reports/revenue', { token: U });
check('other clinic sees none of this clinic\'s money', r.data?.invoiceCount === 1, r.data?.invoiceCount);
r = await call('GET', '/billing/revenue', { token: T });
check('old /billing/revenue removed (single revenue definition)', r.status === 404 || r.status === 400, r.status);

console.log(out.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
