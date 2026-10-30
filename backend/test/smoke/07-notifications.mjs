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

// Fresh clinic: owner (admin), receptionist, assistant, two dentists, two patients
let r = await call('POST', '/auth/register', { body: { clinicName: `Notif ${u}`, email: `owner-${u}@n.am`, password: 'ownerpass1', firstName: 'Own', lastName: 'Er' } });
const T = r.data.accessToken;
const mkStaff = async (role, firstName = role) => {
  const email = `${firstName}-${u}@n.am`;
  const profile = (await call('POST', '/users', { token: T, body: { firstName, lastName: 'S', email, password: 'staffpass1', role } })).data;
  return { profile, token: await login(email, 'staffpass1') };
};
const rec = await mkStaff('receptionist'), asst = await mkStaff('assistant');
const d1 = await mkStaff('dentist', 'dOne'), d2 = await mkStaff('dentist', 'dTwo');
const R = rec.token, A = asst.token, D = d1.token, D2 = d2.token;
const mkPatient = async (n, k) => (await call('POST', '/patients', { token: R, body: { firstName: n, lastName: `Ntf${u}`, dateOfBirth: '1990-01-01', gender: 'female', phone: '+3749' + String(Date.now() + k).slice(-7) } })).data;
const p = await mkPatient('Anna', 1), p2 = await mkPatient('Bob', 2);

const list = (token, q = '') => call('GET', `/notifications${q}`, { token });
const unread = async (token) => (await call('GET', '/notifications/unread-count', { token })).data?.count;
const latest = async (token) => (await list(token, '?limit=1')).data?.data?.[0];
const day = (n, h, m = 0) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); d.setUTCHours(h - 4, m, 0, 0); return d.toISOString(); };
const book = (token, dentist, patient, n, h, extra = {}) => call('POST', '/appointments', { token, body: { patientId: patient._id, dentistId: dentist.profile.authId, startTime: day(n, h), endTime: day(n, h, 30), allowOutsideHours: true, ...extra } });

for (const [name, token] of [['admin', T], ['receptionist', R], ['dentist', D], ['assistant', A]]) {
  check(`${name} starts with 0 unread`, (await unread(token)) === 0, await unread(token));
}

// ── Appointments ──────────────────────────────────────────────────────────
r = await book(R, d1, p, 3, 10);
const a1 = r.data;
check('receptionist books for dOne', r.status === 201, r.body);
let n = await latest(D);
check('dOne told: appointment_created, patient, time, link', n?.type === 'appointment_created' && n.data?.patientName === `Anna Ntf${u}` && n.data.startTime === a1.startTime && n.relatedType === 'appointment' && n.relatedId === a1._id && n.isRead === false, n);
check('who did it is on the notification', n?.actorId?.firstName === 'receptionist', n?.actorId);
check('the receptionist is not told about her own booking', (await unread(R)) === 0, await unread(R));
r = await book(D, d1, p2, 3, 12);
check('dentist books for himself: no notification', r.status === 201 && (await unread(D)) === 1, await unread(D));
r = await call('POST', '/appointments/recurring', { token: R, body: { patientId: p2._id, dentistId: d1.profile.authId, startTime: day(4, 15), endTime: day(4, 15, 30), allowOutsideHours: true, recurringPattern: { frequency: 'weekly', interval: 1, endDate: day(18, 0).slice(0, 10) } } });
n = await latest(D);
check('a series is one notification with its count', r.status === 201 && n?.type === 'appointment_created' && n.data.count === r.data.created.length && r.data.created.length >= 2, { status: r.status, n });

r = await call('PATCH', `/appointments/${a1._id}`, { token: R, body: { startTime: day(3, 11), endTime: day(3, 11, 30), allowOutsideHours: true } });
n = await latest(D);
check('reschedule: dOne told with old and new time', r.status === 200 && n?.type === 'appointment_rescheduled' && n.data.previousStartTime === a1.startTime && n.data.startTime === r.data.startTime, n);
r = await call('PATCH', `/appointments/${a1._id}`, { token: R, body: { notes: 'bring x-ray' } });
check('a note change is not news', (await latest(D))?.type === 'appointment_rescheduled' && (await unread(D)) === 3, await unread(D));
r = await call('PATCH', `/appointments/${a1._id}`, { token: R, body: { dentistId: d2.profile.authId, allowOutsideHours: true } });
const nOld = await latest(D), nNew = await latest(D2);
check('dentist changed: both dentists told', r.status === 200 && nOld?.data?.dentistChanged === true && nNew?.type === 'appointment_rescheduled' && nNew.data.dentistChanged === true, [nOld?.data, nNew?.data]);
r = await call('PATCH', `/appointments/${a1._id}/status`, { token: R, body: { status: 'confirmed' } });
n = await latest(D2);
check('confirmed: dTwo told', r.status === 200 && n?.type === 'appointment_confirmed', n);
r = await call('PATCH', `/appointments/${a1._id}/cancel`, { token: R, body: { reason: 'patient_illness' } });
n = await latest(D2);
check('cancelled: dTwo told with the reason', r.status === 200 && n?.type === 'appointment_cancelled' && n.data.reason === 'patient_illness' && n.data.count === 1, n);

// Patient archived -> each affected dentist told once, with a count
const before = await unread(D);
r = await call('PATCH', `/patients/${p2._id}/status`, { token: T, body: { status: 'archived', reason: 'moved', cancelUpcomingAppointments: true } });
n = await latest(D);
check('patient archived: dOne gets one notification for all his visits', r.status === 200 && r.data.cancelledAppointments >= 3 && n?.type === 'appointment_cancelled' && n.data.reason === 'patient_left' && n.data.count === r.data.cancelledAppointments && n.relatedType === 'patient' && (await unread(D)) === before + 1, { status: r.status, cancelled: r.data?.cancelledAppointments, n });

// Dentist deactivated -> front desk told; the dentist (now inactive) gets nothing
await book(R, d2, p, 5, 9);
r = await call('PATCH', `/users/${d2.profile._id}/status`, { token: T, body: { isActive: false, cancelUpcomingAppointments: true } });
n = await latest(R);
check('dentist deactivated: receptionist told how many to call', r.status === 200 && n?.type === 'dentist_appointments_cancelled' && n.data.count === r.data.cancelledAppointments && n.data.dentistName === 'dTwo S', { status: r.status, n });
check('the admin who did it is not told; the assistant is not told', (await latest(T))?.type !== 'dentist_appointments_cancelled' && (await unread(A)) === 0, [await latest(T), await unread(A)]);
const d2After = await call('GET', '/notifications', { token: D2 });
check('deactivated dentist cannot read notifications any more', d2After.status === 401 || d2After.status === 403, d2After.status);

// ── Payments ──────────────────────────────────────────────────────────────
r = await call('POST', '/billing/invoices', { token: R, body: { patientId: p._id, issue: true, items: [{ description: 'Cleaning', unitPrice: 12000 }] } });
const inv = r.data;
r = await call('POST', `/billing/invoices/${inv._id}/payments`, { token: R, body: { method: 'cash', amount: 5000 } });
const pay = r.data?.payment;
n = await latest(T);
check('payment: admin told with amount in drams, invoice link', n?.type === 'payment_received' && n.data.amount === 5000 && n.data.currency === 'AMD' && n.data.invoiceNumber === inv.invoiceNumber && n.relatedType === 'invoice' && n.relatedId === inv._id, n);
check('payment: receptionist not told about her own payment', (await latest(R))?.type !== 'payment_received', await latest(R));
r = await call('PATCH', `/billing/invoices/${inv._id}/payments/${pay._id}/void`, { token: T, body: { type: 'refund', reason: 'Paid twice' } });
n = await latest(R);
check('refund: the cashier who took it is told, with the reason', r.status === 200 && n?.type === 'payment_refunded' && n.data.amount === 5000 && n.data.reason === 'Paid twice', n);

// ── Own notifications only ────────────────────────────────────────────────
const adminNote = await latest(T);
r = await call('PATCH', `/notifications/${adminNote._id}/read`, { token: D });
check("dentist cannot mark the admin's notification read -> 404", r.status === 404 && r.body.code === 'notificationNotFound', r.body);
r = await call('DELETE', `/notifications/${adminNote._id}`, { token: R });
check("receptionist cannot delete the admin's notification -> 404", r.status === 404, r.status);
r = await call('GET', '/notifications?limit=100', { token: T });
check("the admin's notification is still there, unread", r.data.data.some((x) => x._id === adminNote._id && !x.isRead), r.data?.total);
r = await call('POST', '/auth/register', { body: { clinicName: `Other ${u}`, email: `other-${u}@n.am`, password: 'ownerpass1', firstName: 'Ot', lastName: 'Her' } });
const O = r.data.accessToken;
r = await call('PATCH', `/notifications/${adminNote._id}/read`, { token: O });
check('another clinic cannot touch it -> 404', r.status === 404, r.status);
check('another clinic has no notifications', (await list(O)).data?.total === 0, (await list(O)).data);

// ── Filters, paging, read, delete ─────────────────────────────────────────
const totalD = (await list(D)).data.total, unreadD = await unread(D);
check('dOne: 5 notifications, all unread (booking, series, 2 reschedules, archive)', totalD === unreadD && totalD === 5, [totalD, unreadD]);
r = await list(D, '?limit=2&page=2');
check('paging: page 2 of size 2', r.data.data.length === 2 && r.data.page === 2 && r.data.totalPages === Math.ceil(totalD / 2), r.data);
check('list carries the unread count', r.data.unread === unreadD, r.data.unread);
const first = (await list(D, '?limit=1')).data.data[0];
r = await call('PATCH', `/notifications/${first._id}/read`, { token: D });
check('mark read returns it read; unread count drops', r.status === 200 && r.data.isRead === true && (await unread(D)) === unreadD - 1, r.data);
r = await list(D, '?isRead=false&limit=100');
check('isRead=false: unread only (was returning read ones)', r.data.total === unreadD - 1 && r.data.data.every((x) => !x.isRead), r.data.total);
r = await list(D, '?isRead=true');
check('isRead=true: read only', r.data.total === 1 && r.data.data[0]._id === first._id, r.data.total);
r = await list(D, '?isRead=maybe');
check('isRead=maybe -> 400', r.status === 400, r.status);
r = await call('PATCH', '/notifications/read-all', { token: D });
check('read all -> 0 unread', r.status === 200 && (await unread(D)) === 0, r.data);
r = await call('DELETE', `/notifications/${first._id}`, { token: D });
check('delete own', r.status === 200 && (await list(D)).data.total === totalD - 1, r.body);
r = await call('DELETE', `/notifications/${first._id}`, { token: D });
check('delete again -> 404', r.status === 404, r.status);
r = await call('DELETE', '/notifications/read', { token: D });
check('delete all read', r.status === 200 && r.data.deletedCount === totalD - 1 && (await list(D)).data.total === 0, r.data);
check('the others keep theirs', (await unread(T)) >= 1 && (await unread(R)) >= 1, [await unread(T), await unread(R)]);

console.log(out.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
