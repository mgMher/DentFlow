const API = process.env.API_URL || 'http://127.0.0.1:8000/api';
let pass = 0, fail = 0;
const results = [];
async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json, data: json?.data };
}
function check(name, cond, detail) {
  if (cond) { pass++; results.push(`PASS ${name}`); }
  else { fail++; results.push(`FAIL ${name} :: ${JSON.stringify(detail)?.slice(0, 300)}`); }
}
const uniq = Date.now().toString(36);
const login = (email, password) => call('POST', '/auth/login', { body: { email, password } });

// --- login basics
let r = await login('admin@ararat-dental.am', 'wrong-password');
check('wrong password -> 401 invalidCredentials', r.status === 401 && r.body.code === 'invalidCredentials', r.body);
r = await login(`nobody-${uniq}@x.am`, 'whatever1');
check('unknown email -> same 401', r.status === 401 && r.body.code === 'invalidCredentials', r.body);
r = await login('admin@ararat-dental.am', 'admin123');
check('admin login ok', r.status === 200 && r.data?.accessToken, r.body);
const A1 = r.data; 
r = await call('GET', '/auth/me', { token: A1.accessToken });
check('GET /auth/me', r.status === 200 && r.data?.email === 'admin@ararat-dental.am' && !('password' in r.data), r.body);
const clinicA = r.data.clinicId?._id || r.data.clinicId;

// --- bad ids
r = await call('GET', '/appointments/abc', { token: A1.accessToken });
check('bad id -> 400 (not 500)', r.status === 400, r.body);
r = await call('GET', '/billing/invoices/abc', { token: A1.accessToken });
check('bad invoice id -> 400', r.status === 400, r.body);

// --- register clinic B
const emailB = `owner-${uniq}@clinic-b.am`;
r = await call('POST', '/auth/register', { body: { clinicName: `Clinic B ${uniq}`, email: emailB, password: 'short', firstName: 'Bob', lastName: 'Brown' } });
check('register short password -> 400', r.status === 400, r.body);
r = await call('POST', '/auth/register', { body: { clinicName: `Clinic B ${uniq}`, email: emailB, password: 'bpassword1', firstName: 'Bob', lastName: 'Brown', phone: '093 123456' } });
check('register clinic B', r.status === 201 && r.data?.accessToken, r.body);
const B = r.data;
r = await call('POST', '/auth/register', { body: { clinicName: 'Dup', email: emailB, password: 'bpassword1', firstName: 'X', lastName: 'Y' } });
check('register duplicate email -> 409 accountEmailTaken', r.status === 409 && r.body.code === 'accountEmailTaken', r.body);
r = await call('GET', '/users', { token: B.accessToken });
const founder = (r.data?.data || []).find((u) => u.email === emailB);
check('founder listed in staff', !!founder && founder.role === 'clinic_admin', r.body);
r = await call('GET', '/treatments?limit=100', { token: B.accessToken });
const treatB = r.data?.data || r.data || [];
check('new clinic has default treatments', treatB.length > 0, r.body?.data?.pagination || r.status);
r = await call('GET', '/clinics/current', { token: B.accessToken });
check('clinic phone normalised + email set', r.data?.phone === '+37493123456' && r.data?.email === emailB, r.data);

// --- B data: a patient and a dentist
r = await call('POST', '/patients', { token: B.accessToken, body: { firstName: 'Bpat', lastName: 'Patient', dateOfBirth: '1990-01-01', phone: '+37491111111', gender: 'male' } });
check('create patient in B', r.status === 201, r.body);
const patientB = r.data?._id;
r = await call('POST', '/users', { token: B.accessToken, body: { firstName: 'Dent', lastName: 'B', email: `dent-${uniq}@clinic-b.am`, password: 'dentpass1', role: 'dentist' } });
check('create dentist in B', r.status === 201, r.body);
const dentistBAuth = r.data?.authId;

// --- A data
r = await call('GET', '/patients?limit=5', { token: A1.accessToken });
const patientA = (r.data?.data || [])[0]?._id;
r = await call('GET', '/users/dentists', { token: A1.accessToken });
const dentistA = (r.data || [])[0]?.authId;
check('A has patient and dentist', patientA && dentistA, { patientA, dentistA });
// A random weekday slot 3–60 days ahead, 09:00–16:30 Yerevan (UTC+4), so re-runs don't collide.
const start = new Date(Date.now() + 86400000 * (3 + Math.floor(Math.random() * 58)));
while ([0, 6].includes(start.getUTCDay())) start.setUTCDate(start.getUTCDate() + 1);
start.setUTCHours(5 + Math.floor(Math.random() * 7), Math.random() < 0.5 ? 0 : 30, 0, 0);
const end = new Date(start.getTime() + 30 * 60000);

// --- cross-tenant blocks
r = await call('POST', '/appointments', { token: A1.accessToken, body: { patientId: patientB, dentistId: dentistA, startTime: start, endTime: end, title: 'x' } });
check('A cannot book B patient -> 404 patientNotFound', r.status === 404 && r.body.code === 'patientNotFound', r.body);
r = await call('POST', '/appointments', { token: A1.accessToken, body: { patientId: patientA, dentistId: dentistBAuth, startTime: start, endTime: end, title: 'x' } });
check('A cannot use B dentist -> 404 dentistNotFound', r.status === 404 && r.body.code === 'dentistNotFound', r.body);
r = await call('POST', '/appointments', { token: A1.accessToken, body: { patientId: patientA, dentistId: dentistA, startTime: start, endTime: end, title: 'ok' } });
check('A books own patient/dentist', r.status === 201, r.body);
r = await call('POST', '/billing/invoices', { token: A1.accessToken, body: { patientId: patientB, currency: 'AMD', items: [{ description: 'x', quantity: 1, unitPrice: 100 }] } });
check('A cannot invoice B patient -> 404', r.status === 404 && r.body.code === 'patientNotFound', r.body);
r = await call('POST', `/dental-records/${patientB}/treatment-entry`, { token: A1.accessToken, body: { toothNumber: 1, treatmentName: 'x' } });
check('A cannot chart B patient -> 404', r.status === 404, r.body);

// --- API-created patient in B is bookable (was broken by string clinicIds)
r = await call('POST', '/users', { token: B.accessToken, body: { firstName: 'Dent2', lastName: 'B', email: `dent2-${uniq}@clinic-b.am`, password: 'dentpass1', role: 'dentist' } });
const dentist2B = r.data?.authId;
r = await call('POST', '/appointments', { token: B.accessToken, body: { patientId: patientB, dentistId: dentist2B, startTime: start, endTime: end, title: 'b' } });
check('B books its own API-created patient', r.status === 201, r.body);
r = await call('GET', '/appointments', { token: B.accessToken });
check('B lists that appointment', (r.data?.appointments || []).length >= 1, r.body);
r = await call('GET', '/patients/stats', { token: B.accessToken });
check('patient stats: active counted', (r.data?.byStatus?.active ?? r.data?.active ?? 0) >= 1, r.data);
r = await call('POST', '/billing/invoices', { token: B.accessToken, body: { patientId: patientB, currency: 'AMD', items: [{ description: 'Exam', quantity: 1, unitPrice: 5000 }] } });
check('B invoices its own patient', r.status === 201, r.body);
r = await call('GET', '/billing/invoices', { token: B.accessToken });
check('B lists that invoice', (r.data?.data || []).length >= 1, r.body);

// --- patient search (picker)
r = await call('GET', '/patients?search=Pat&limit=20&sortBy=lastName', { token: B.accessToken });
check('patient search works', r.status === 200 && (r.data?.data || []).some((p) => p._id === patientB), r.body);

// --- sessions: two devices, rotation, reuse
r = await login('admin@ararat-dental.am', 'admin123');
const A2 = r.data;
r = await call('GET', '/auth/me', { token: A1.accessToken });
check('device 1 still valid after device 2 login', r.status === 200, r.body);
const t0 = A2.refreshToken;
r = await call('POST', '/auth/refresh', { body: { refreshToken: t0 } });
check('refresh rotates', r.status === 200 && r.data.refreshToken !== t0, r.body);
const t1 = r.data.refreshToken;
r = await call('POST', '/auth/refresh', { body: { refreshToken: t0 } });
check('old token within grace (two tabs) accepted', r.status === 200, r.body);
r = await call('POST', '/auth/refresh', { body: { refreshToken: t0 } });
check('token two rotations old -> revoked', r.status === 401 && r.body.code === 'sessionRevoked', r.body);
r = await call('POST', '/auth/refresh', { body: { refreshToken: t1 } });
check('session is dead after reuse detection', r.status === 401, r.body);

// --- logout this device only
r = await login('admin@ararat-dental.am', 'admin123'); const A3 = r.data;
r = await call('POST', '/auth/logout', { token: A3.accessToken });
check('logout ok', r.status === 200, r.body);
r = await call('GET', '/auth/me', { token: A3.accessToken });
check('logged-out device rejected', r.status === 401, r.body);
r = await call('GET', '/auth/me', { token: A1.accessToken });
check('other device still valid', r.status === 200, r.body);

// --- change password (clinic B owner)
r = await login(emailB, 'bpassword1'); const B2 = r.data;
r = await call('POST', '/auth/change-password', { token: B.accessToken, body: { currentPassword: 'nope-nope', newPassword: 'bpassword2' } });
check('change password wrong current -> 400', r.status === 400 && r.body.code === 'wrongCurrentPassword', r.body);
r = await call('POST', '/auth/change-password', { token: B.accessToken, body: { currentPassword: 'bpassword1', newPassword: 'bpassword2' } });
check('change password ok', r.status === 200, r.body);
r = await call('GET', '/auth/me', { token: B.accessToken });
check('this device stays signed in', r.status === 200, r.body);
r = await call('GET', '/auth/me', { token: B2.accessToken });
check('other device signed out', r.status === 401, r.body);
r = await login(emailB, 'bpassword2');
check('new password works', r.status === 200, r.body);

// --- admin reset + lockout (dentist in B)
const dentEmail = `dent-${uniq}@clinic-b.am`;
r = await login(dentEmail, 'dentpass1'); const D1 = r.data;
check('dentist login', r.status === 200, r.body);
for (let i = 0; i < 5; i++) await login(dentEmail, 'wrongpass!');
r = await login(dentEmail, 'dentpass1');
check('locked after 5 wrong -> 429 accountLocked', r.status === 429 && r.body.code === 'accountLocked' && r.body.minutes > 0, r.body);
r = await call('GET', '/users', { token: B.accessToken });
const dentProfile = (r.data?.data || []).find((u) => u.email === dentEmail);
r = await call('POST', `/users/${dentProfile._id}/reset-password`, { token: B.accessToken, body: { newPassword: 'dentpass2' } });
check('admin reset password', r.status === 200, r.body);
r = await call('GET', '/auth/me', { token: D1.accessToken });
check('reset signs member out', r.status === 401, r.body);
r = await login(dentEmail, 'dentpass2');
check('reset clears lockout + new pw works', r.status === 200, r.body);
const D2 = r.data;
r = await call('POST', `/users/${founder._id}/reset-password`, { token: B.accessToken, body: { newPassword: 'whatever12' } });
check('admin cannot reset own password here', r.status === 400 && r.body.code === 'useChangePassword', r.body);

// --- deactivation is immediate
r = await call('PATCH', `/users/${dentProfile._id}/status`, { token: B.accessToken, body: { isActive: false } });
check('deactivate dentist', r.status === 200, r.body);
r = await call('GET', '/auth/me', { token: D2.accessToken });
check('deactivated user rejected immediately', r.status === 401, r.body);

// --- clinic settings
r = await call('PATCH', '/clinics/current', { token: B.accessToken, body: { subscription: { status: 'active' } } });
check('subscription not editable -> 400', r.status === 400, r.body);
r = await call('PATCH', '/clinics/current', { token: B.accessToken, body: { email: '', phone: '' } });
check('empty email/phone accepted', r.status === 200 && r.data.email === '' , r.body);
r = await call('PATCH', '/clinics/current', { token: B.accessToken, body: { phone: '123' } });
check('bad phone -> 400', r.status === 400, r.body);
r = await call('PATCH', '/clinics/current/working-hours', { token: B.accessToken, body: { workingHours: [{ dayOfWeek: 1, startTime: '18:00', endTime: '09:00', isOpen: true }] } });
check('end before start -> 400', r.status === 400 && r.body.code === 'availabilityEndBeforeStart', r.body);
r = await call('PATCH', '/clinics/current/working-hours', { token: B.accessToken, body: { workingHours: [{ dayOfWeek: 1, startTime: '9:00', endTime: '18:00' }] } });
check('bad HH:mm -> 400', r.status === 400, r.body);
r = await call('PATCH', '/clinics/current/settings', { token: B.accessToken, body: { timezone: 'Mars/Olympus' } });
check('bad timezone -> 400', r.status === 400, r.body);

// --- rooms
r = await call('POST', '/schedule/rooms', { token: B.accessToken, body: { name: 'Room 1' } });
const room = r.data?._id;
r = await call('PATCH', `/schedule/rooms/${room}`, { token: B.accessToken, body: { name: 'Room One' } });
check('room edit', r.status === 200 && r.data.name === 'Room One', r.body);
r = await call('DELETE', `/schedule/rooms/${room}`, { token: B.accessToken });
check('room deactivate', r.status === 200 && r.data.isActive === false, r.body);
r = await call('PATCH', `/schedule/rooms/${room}`, { token: B.accessToken, body: { isActive: true } });
check('room reactivate', r.status === 200 && r.data.isActive === true, r.body);

// --- roles
r = await login('reception@ararat-dental.am', 'reception123');
const R = r.data;
r = await call('PATCH', '/clinics/current', { token: R.accessToken, body: { name: 'hack' } });
check('receptionist cannot edit clinic -> 403 forbidden code', r.status === 403 && r.body.code === 'forbidden', r.body);

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
