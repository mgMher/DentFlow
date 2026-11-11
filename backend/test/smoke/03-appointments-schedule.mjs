const API = process.env.API_URL || 'http://127.0.0.1:8000/api';
let pass = 0, fail = 0; const out = [];
async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json, data: json?.data };
}
const check = (n, c, d) => { if (c) { pass++; out.push('PASS ' + n); } else { fail++; out.push(`FAIL ${n} :: ${JSON.stringify(d)?.slice(0, 280)}`); } };
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).data;
const u = Date.now().toString(36);

// Fresh clinic, Mon–Fri 09–18 Yerevan
let r = await call('POST', '/auth/register', { body: { clinicName: `Sched ${u}`, email: `owner-${u}@s.am`, password: 'ownerpass1', firstName: 'Own', lastName: 'Er' } });
const O = r.data; const T = O.accessToken;
r = await call('PATCH', '/clinics/current/working-hours', { token: T, body: { workingHours: [0,1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isOpen: d >= 1 && d <= 5 })) } });
check('set clinic hours', r.status === 200, r.body);
const mkDentist = async (n) => (await call('POST', '/users', { token: T, body: { firstName: n, lastName: 'D', email: `${n}-${u}@s.am`, password: 'dentpass1', role: 'dentist' } })).data;
const d1 = await mkDentist('dOne'), d2 = await mkDentist('dTwo');
const mkPatient = async (n, k) => (await call('POST', '/patients', { token: T, body: { firstName: n, lastName: 'P', dateOfBirth: '1990-01-01', gender: 'male', phone: '+3749' + String(Date.now() + k).slice(-7) } })).data;
const p1 = await mkPatient('pOne', 1), p2 = await mkPatient('pTwo', 2), p3 = await mkPatient('pThree', 3);
const room = (await call('POST', '/schedule/rooms', { token: T, body: { name: 'Chair A' } })).data;
r = await call('POST', '/schedule/rooms', { token: T, body: { name: 'chair a' } });
check('duplicate room name -> 409', r.status === 409 && r.body.code === 'roomNameTaken', r.body);

// next Monday (Yerevan = UTC+4): local 09:00 = 05:00Z
const now = new Date(); const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
mon.setUTCDate(mon.getUTCDate() + ((8 - mon.getUTCDay()) % 7 || 7) + 7);
const at = (h, m = 0, dayOffset = 0) => new Date(mon.getTime() + dayOffset * 86400000 + ((h - 4) * 60 + m) * 60000).toISOString();
const book = (dentist, patient, s, e, extra = {}) => call('POST', '/appointments', { token: T, body: { patientId: patient._id, dentistId: dentist.authId, startTime: s, endTime: e, ...extra } });

r = await book(d1, p1, at(9), at(9, 30), { treatmentRoomId: room._id });
check('book 09:00-09:30', r.status === 201 && r.data.startTime === at(9), r.body); const a1 = r.data;
check('response populated (room, patient)', r.data?.treatmentRoomId?.name === 'Chair A' && r.data?.patientId?.firstName === 'pOne', r.data);
r = await book(d1, p2, at(9, 15), at(9, 45));
check('same dentist overlap -> conflictDentist', r.status === 409 && r.body.code === 'appointmentConflictDentist', r.body);
r = await book(d2, p1, at(9, 15), at(9, 45));
check('same patient overlap -> conflictPatient', r.status === 409 && r.body.code === 'appointmentConflictPatient', r.body);
r = await book(d2, p2, at(9, 15), at(9, 45), { treatmentRoomId: room._id });
check('same room overlap -> conflictRoom', r.status === 409 && r.body.code === 'appointmentConflictRoom', r.body);
r = await book(d1, p2, at(9, 30), at(10));
check('touching edge allowed', r.status === 201, r.body); const a2 = r.data;
r = await book(d1, p2, at(19), at(19, 30));
check('after hours -> outsideHours', r.status === 409 && r.body.code === 'appointmentOutsideHours', r.body);
r = await book(d1, p2, at(19), at(19, 30), { allowOutsideHours: true });
check('after hours with override -> 201', r.status === 201, r.body);
r = await book(d1, p2, at(10, 0, -1), at(10, 30, -1));
check('Sunday (closed) -> outsideHours', r.status === 409 && r.body.code === 'appointmentOutsideHours', r.body);

// blocked time
r = await call('POST', '/schedule/blocked-times', { token: T, body: { dentistId: d1.authId, startTime: at(12), endTime: at(13), reason: 'lunch' } });
check('block 12-13', r.status === 201 && r.data.overlappingAppointments === 0, r.body);
r = await book(d1, p3, at(12, 15), at(12, 45), { allowOutsideHours: true });
check('blocked time never overridden', r.status === 409 && r.body.code === 'appointmentInBlockedTime', r.body);
r = await call('POST', '/schedule/blocked-times', { token: T, body: { dentistId: d1.authId, startTime: at(9, 15), endTime: at(9, 20), reason: 'personal' } });
check('block over booking warns', r.data?.overlappingAppointments === 1, r.data);
const monLocal = new Date(at(12)).toISOString().slice(0, 10);
r = await call('GET', `/schedule/blocked-times?startDate=${monLocal}&endDate=${monLocal}&dentistId=${d1.authId}`, { token: T });
check('blocked times for the day', r.data?.length === 2, r.data?.length);

// availability in clinic time
const date = new Date(at(12)).toISOString().slice(0, 10);
r = await call('GET', `/schedule/availability/${d1.authId}?date=${date}`, { token: T });
check('availability starts after bookings, ends 18:00 local', r.data?.[0]?.start === at(10) && r.data?.at(-1)?.end === at(18), r.data);
check('lunch gap present', r.data?.some((s) => s.end === at(12)) && r.data?.some((s) => s.start === at(13)), r.data);

// status rules
r = await call('PATCH', `/appointments/${a1._id}/status`, { token: T, body: { status: 'completed' } });
check('future -> completed refused', r.status === 400 && r.body.code === 'appointmentNotStarted', r.body);
r = await call('PATCH', `/appointments/${a1._id}/status`, { token: T, body: { status: 'cancelled' } });
check('status=cancelled refused (use cancel)', r.status === 400 && r.body.code === 'useCancelEndpoint', r.body);
r = await call('PATCH', `/appointments/${a1._id}/status`, { token: T, body: { status: 'banana' } });
check('unknown status -> 400', r.status === 400, r.body);
r = await call('PATCH', `/appointments/${a1._id}/status`, { token: T, body: { status: 'confirmed' } });
check('scheduled -> confirmed', r.status === 200 && r.data.status === 'confirmed' && r.data.treatmentRoomId?.name === 'Chair A', r.body);
r = await call('PATCH', `/appointments/${a1._id}/cancel`, { token: T, body: { reason: 'patient_illness', note: 'flu' } });
check('cancel with reason', r.status === 200 && r.data.status === 'cancelled' && r.data.cancelReason === 'patient_illness' && r.data.cancelledBy, r.body);
r = await call('PATCH', `/appointments/${a1._id}/cancel`, { token: T, body: { reason: 'nonsense' } });
check('cancel twice / bad reason -> 400', r.status === 400, r.body);
r = await book(d2, p3, at(9), at(9, 30), { treatmentRoomId: room._id });
check('freed slot rebooked by someone else', r.status === 201, r.body);
r = await call('PATCH', `/appointments/${a1._id}/status`, { token: T, body: { status: 'scheduled' } });
check('un-cancel into taken slot -> conflict', r.status === 409, r.body);

// past visit, completion, lastVisit
const lastWeekMon = new Date(mon.getTime() - 14 * 86400000);
const past = (h) => new Date(lastWeekMon.getTime() + (h - 4) * 3600000).toISOString();
r = await book(d2, p3, past(11), past(11.5));
check('record a past visit', r.status === 201, r.body);
r = await call('PATCH', `/appointments/${r.data._id}/status`, { token: T, body: { status: 'completed' } });
check('past -> completed', r.status === 200 && r.data.status === 'completed', r.body);
const completedId = r.data._id;
r = await call('PATCH', `/appointments/${completedId}/status`, { token: T, body: { status: 'scheduled' } });
check('completed is final', r.status === 400 && r.body.code === 'invalidStatusTransition', r.body);
r = await call('PATCH', `/appointments/${completedId}`, { token: T, body: { notes: 'x' } });
check('completed not editable', r.status === 400 && r.body.code === 'appointmentNotEditable', r.body);
r = await call('GET', `/patients/${p3._id}`, { token: T });
check('lastVisit stamped', !!r.data?.lastVisit, r.data?.lastVisit);

// reschedule
r = await call('PATCH', `/appointments/${a2._id}`, { token: T, body: { startTime: at(9), endTime: at(9, 30) } });
check('reschedule into conflict -> 409', r.status === 409, r.body);
r = await call('PATCH', `/appointments/${a2._id}`, { token: T, body: { startTime: at(14), endTime: at(14, 45) } });
check('reschedule ok, duration recomputed', r.status === 200 && r.data.duration === 45, r.body);
r = await call('PATCH', `/appointments/${a2._id}`, { token: T, body: { patientId: p1._id } });
check('cannot move to another patient', r.status === 400, r.body);

// list + calendar
const rangeStart = at(0), rangeEnd = at(0, 0, 1);
r = await call('GET', `/appointments?startDate=${rangeStart}&endDate=${rangeEnd}&dentistId=${d1.authId}&limit=2&page=1`, { token: T });
check('list filtered + paginated', r.data?.appointments?.length === 2 && r.data.pagination.total >= 3, r.data?.pagination);
r = await call('GET', `/appointments?limit=1000`, { token: T });
check('limit > 100 -> 400', r.status === 400, r.body);
r = await call('GET', `/appointments/calendar?startDate=${rangeStart}&endDate=${rangeEnd}`, { token: T });
check('calendar same shape, cancelled hidden', r.data?.length >= 3 && r.data.every((x) => x.startTime && x.patientId?.firstName && x.status !== 'cancelled'), r.data?.filter((x) => !(x.startTime && x.patientId?.firstName && x.status !== 'cancelled')).map((x) => ({ s: x.status, p: x.patientId, t: x.startTime })));
r = await call('GET', `/appointments/calendar?startDate=${rangeStart}&endDate=${rangeEnd}&includeCancelled=true`, { token: T });
check('calendar can include cancelled', r.data?.some((x) => x.status === 'cancelled'), r.data?.length);
r = await call('GET', '/appointments/today', { token: T });
check('today endpoint', r.status === 200 && Array.isArray(r.data), r.body);

// recurring
r = await call('POST', '/appointments/recurring', { token: T, body: { patientId: p2._id, dentistId: d2.authId, startTime: at(15, 0, 7), endTime: at(15, 30, 7), recurringPattern: { frequency: 'weekly', interval: 1, endDate: new Date(mon.getTime() + 34 * 86400000).toISOString().slice(0, 10) } } });
check('weekly series: 4 Mondays', r.status === 201 && r.data.created.length === 4 && r.data.skipped.length === 0, r.data && { c: r.data.created?.length, s: r.data.skipped });
check('series keeps 15:00 local', r.data?.created?.every((a) => new Date(a.startTime).getUTCHours() === 11), r.data?.created?.map((a) => a.startTime));
const series = r.data.created;
r = await call('PATCH', `/appointments/${series[1]._id}/cancel`, { token: T, body: { reason: 'clinic_rescheduled', scope: 'following' } });
check('cancel this and following -> 3', r.data?.cancelledCount === 3, r.data?.cancelledCount);
r = await call('POST', '/appointments/recurring', { token: T, body: { patientId: p3._id, dentistId: d2.authId, startTime: at(16, 0, 7), endTime: at(16, 30, 7), recurringPattern: { frequency: 'daily', interval: 1, endDate: new Date(mon.getTime() + 300 * 86400000).toISOString().slice(0, 10) } } });
check('daily series capped at 52, weekends skipped', r.status === 201 && r.data.created.length + r.data.skipped.length === 52 && r.data.skipped.every((s) => s.code === 'appointmentOutsideHours'), r.data && { c: r.data.created?.length, s: r.data.skipped?.length });
r = await call('POST', '/appointments/recurring', { token: T, body: { patientId: p3._id, dentistId: d2.authId, startTime: at(16), endTime: at(16, 30), recurringPattern: { frequency: 'daily', interval: 1, endDate: '2020-01-01' } } });
check('series ending before start -> 400', r.status === 400 && r.body.code === 'seriesEndBeforeStart', r.body);
r = await call('POST', '/appointments/recurring', { token: T, body: { patientId: p3._id, dentistId: d2.authId, startTime: at(16), endTime: at(16, 30), recurringPattern: { frequency: 'monthly', interval: 1, endDate: '2099-01-01' } } });
check('series longer than a year -> 400', r.status === 400 && r.body.code === 'seriesTooLong', r.body);
r = await call('POST', '/appointments', { token: T, body: { patientId: p3._id, dentistId: d2.authId, startTime: at(16), endTime: at(16, 30), status: 'completed' } });
check('status on create rejected', r.status === 400, r.body);

// concurrency
const s = at(11, 0, 2), e = at(11, 30, 2);
const results = await Promise.all([book(d1, p1, s, e), book(d1, p2, s, e), book(d1, p3, s, e)]);
check('3 parallel bookings, exactly 1 wins', results.filter((x) => x.status === 201).length === 1 && results.filter((x) => x.status === 409).length === 2, results.map((x) => x.status));

// blocked-time roles
const D1 = await login(`dOne-${u}@s.am`, 'dentpass1');
r = await call('POST', '/schedule/blocked-times', { token: D1.accessToken, body: { dentistId: d2.authId, startTime: at(15, 0, 3), endTime: at(16, 0, 3), reason: 'meeting' } });
check('dentist cannot block a colleague', r.status === 403 && r.body.code === 'blockOwnTimeOnly', r.body);
r = await call('POST', '/schedule/blocked-times', { token: D1.accessToken, body: { dentistId: d1.authId, startTime: at(15, 0, 3), endTime: at(16, 0, 3), reason: 'meeting' } });
check('dentist blocks own time', r.status === 201, r.body);

console.log(out.join('\n')); console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
