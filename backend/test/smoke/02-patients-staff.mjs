const API = process.env.API_URL || 'http://127.0.0.1:8000/api';
let pass = 0, fail = 0; const out = [];
async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json, data: json?.data };
}
const check = (n, c, d) => { if (c) { pass++; out.push('PASS ' + n); } else { fail++; out.push(`FAIL ${n} :: ${JSON.stringify(d)?.slice(0, 260)}`); } };
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).data;
const u = Date.now().toString(36);

const A = await login('admin@ararat-dental.am', 'admin123');
const R = await login('reception@ararat-dental.am', 'reception123');
check('logins', A?.accessToken && R?.accessToken, { A: !!A, R: !!R });

// --- patients: create, families share email, search, duplicates
const base = { dateOfBirth: '2015-04-02', gender: 'female', phone: '+37491' + String(Date.now()).slice(-6) };
let r = await call('POST', '/patients', { token: A.accessToken, body: { firstName: 'Lilit', lastName: `Sargsyan${u}`, email: `family-${u}@x.am`, ...base } });
check('create patient', r.status === 201, r.body); const p1 = r.data;
r = await call('POST', '/patients', { token: A.accessToken, body: { firstName: 'Davit', lastName: `Sargsyan${u}`, email: `family-${u}@x.am`, dateOfBirth: '2018-01-01', gender: 'male', phone: '+37491' + String(Date.now() + 7).slice(-6) } });
check('sibling with same email allowed', r.status === 201, r.body); const p2 = r.data;
r = await call('GET', `/patients?search=${encodeURIComponent(`Lilit Sargsyan${u}`)}`, { token: A.accessToken });
check('multi-word search finds exactly her', r.data?.data?.length === 1 && r.data.data[0]._id === p1._id, r.data);
r = await call('GET', `/patients/duplicates?firstName=lilit&lastName=SARGSYAN${u}&dateOfBirth=2015-04-02`, { token: A.accessToken });
check('duplicate by name+dob (case-insensitive)', r.data?.length === 1 && r.data[0]._id === p1._id, r.data);
r = await call('GET', `/patients/duplicates?email=family-${u}@x.am&excludeId=${p1._id}`, { token: A.accessToken });
check('duplicate by email, excluding self', r.data?.length === 1 && r.data[0]._id === p2._id, r.data);
r = await call('GET', `/patients/duplicates?phone=${encodeURIComponent('0' + base.phone.slice(4))}`, { token: A.accessToken });
check('duplicate by phone (local format)', r.data?.some((x) => x._id === p1._id), r.data);

// --- null on required fields, status not editable via PATCH
r = await call('PATCH', `/patients/${p1._id}`, { token: A.accessToken, body: { firstName: null } });
check('firstName null -> 400', r.status === 400, r.body);
r = await call('PATCH', `/patients/${p1._id}`, { token: A.accessToken, body: { status: 'deceased' } });
check('status via PATCH rejected', r.status === 400, r.body);
r = await call('PATCH', `/patients/${p1._id}`, { token: A.accessToken, body: { patronymic: null, notes: 'x' } });
check('optional field null still clears', r.status === 200 && !r.data.patronymic, r.body);

// --- roles
r = await call('PATCH', `/patients/${p1._id}`, { token: R.accessToken, body: { phone: '093 55 44 33' } });
check('receptionist edits contact details', r.status === 200 && r.data.phone === '+37493554433', r.body);
r = await call('PATCH', `/patients/${p1._id}`, { token: R.accessToken, body: { medicalHistory: { allergies: ['x'] } } });
check('receptionist cannot change medical history', r.status === 403 && r.body.code === 'medicalHistoryForbidden', r.body);
r = await call('PATCH', `/patients/${p1._id}/status`, { token: R.accessToken, body: { status: 'archived' } });
check('receptionist cannot change status', r.status === 403, r.body);
r = await call('POST', '/users', { token: A.accessToken, body: { firstName: 'Asya', lastName: 'Assistant', email: `asst-${u}@x.am`, password: 'assistpass1', role: 'assistant' } });
const S = await login(`asst-${u}@x.am`, 'assistpass1');
r = await call('POST', '/patients', { token: S.accessToken, body: { firstName: 'No', lastName: 'Way', ...base } });
check('assistant cannot create patients', r.status === 403, r.body);
r = await call('GET', `/patients/${p1._id}`, { token: S.accessToken });
check('assistant can read patients', r.status === 200, r.body);

// --- upcoming appointments + cancel on archive
r = await call('POST', '/users', { token: A.accessToken, body: { firstName: 'New', lastName: 'Dentist', email: `nd-${u}@x.am`, password: 'dentpass1', role: 'dentist', specialization: 'orthodontics' } });
check('new dentist created', r.status === 201, r.body);
const newDentist = r.data;
check('new dentist gets clinic opening hours', (newDentist?.schedule?.defaultAvailability || []).length >= 5, newDentist?.schedule);
const day = new Date(Date.now() + 86400000 * 9); day.setUTCHours(7, 0, 0, 0);
// A weekday: the demo clinic is closed at weekends, and this books without the hours override.
while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
for (let k = 0; k < 2; k++) {
  const s = new Date(day.getTime() + k * 3600000), e = new Date(s.getTime() + 1800000);
  r = await call('POST', '/appointments', { token: A.accessToken, body: { patientId: p1._id, dentistId: newDentist.authId, startTime: s, endTime: e, title: 'x' } });
}
check('booked 2 appointments', r.status === 201, r.body);
r = await call('GET', `/patients/${p1._id}/upcoming-appointments`, { token: A.accessToken });
check('patient upcoming count = 2', r.data?.count === 2, r.data);
r = await call('GET', `/users/${newDentist._id}/upcoming-appointments`, { token: A.accessToken });
check('dentist upcoming count = 2', r.data?.count === 2, r.data);
r = await call('PATCH', `/patients/${p1._id}/status`, { token: A.accessToken, body: { status: 'archived', reason: 'moved', cancelUpcomingAppointments: true } });
check('archive + cancel appointments', r.status === 200 && r.data.status === 'archived' && r.data.cancelledAppointments === 2, r.data && { status: r.data.status, c: r.data.cancelledAppointments });
r = await call('GET', `/patients/${p1._id}/upcoming-appointments`, { token: A.accessToken });
check('no upcoming left', r.data?.count === 0, r.data);
r = await call('POST', '/appointments', { token: A.accessToken, body: { patientId: p1._id, dentistId: newDentist.authId, startTime: day, endTime: new Date(day.getTime() + 1800000), title: 'x' } });
check('archived patient cannot be booked', r.status === 400 && r.body.code === 'patientClosed', r.body);

// --- staff guards
r = await call('GET', '/users', { token: A.accessToken });
const me = (r.data?.data || []).find((x) => x.email === 'admin@ararat-dental.am');
r = await call('PATCH', `/users/${me._id}`, { token: A.accessToken, body: { isActive: false } });
check('isActive via PATCH /users rejected', r.status === 400, r.body);
r = await call('PATCH', `/users/${me._id}`, { token: A.accessToken, body: { role: null } });
check('role null rejected', r.status === 400, r.body);
r = await call('PATCH', `/users/${newDentist._id}`, { token: A.accessToken, body: { specialization: 'wizardry' } });
check('unknown specialization rejected', r.status === 400, r.body);
r = await call('PATCH', `/users/${newDentist._id}`, { token: A.accessToken, body: { avatar: 'javascript:alert(1)' } });
check('bad avatar rejected', r.status === 400, r.body);
r = await call('PATCH', `/users/${newDentist._id}`, { token: A.accessToken, body: { phone: '094 11 22 33' } });
check('staff phone normalised', r.status === 200 && r.data.phone === '+37494112233', r.body);
r = await call('PATCH', `/users/${newDentist._id}/status`, { token: A.accessToken, body: { isActive: false, cancelUpcomingAppointments: true } });
check('deactivate dentist', r.status === 200, r.body);
r = await call('PATCH', `/users/${me._id}/status`, { token: A.accessToken, body: { isActive: false } });
check('cannot deactivate self', r.status === 400 && r.body.code === 'cannotDeactivateSelf', r.body);

// --- stats
r = await call('GET', '/patients/stats', { token: A.accessToken });
check('stats: active > 0, archived >= 1', r.data?.activePatients > 0 && r.data?.byStatus?.archived >= 1, r.data);
check('stats: new this month counts today', r.data?.newPatientsThisMonth >= 2, r.data);

// --- body limit
r = await call('PATCH', `/patients/${p2._id}`, { token: A.accessToken, body: { photo: 'data:image/jpeg;base64,' + 'A'.repeat(200_000) } });
check('oversized photo -> 400 (not 413)', r.status === 400, r.status);

console.log(out.join('\n')); console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
