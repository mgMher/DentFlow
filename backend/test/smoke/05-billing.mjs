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
const year = new Date().getFullYear();

// Fresh AMD clinic with every role and two patients
let r = await call('POST', '/auth/register', { body: { clinicName: `Bill ${u}`, email: `owner-${u}@b.am`, password: 'ownerpass1', firstName: 'Own', lastName: 'Er' } });
const T = r.data.accessToken;
const mkStaff = async (role) => {
  const email = `${role}-${u}@b.am`;
  await call('POST', '/users', { token: T, body: { firstName: role, lastName: 'S', email, password: 'staffpass1', role } });
  return login(email, 'staffpass1');
};
const R = await mkStaff('receptionist'), D = await mkStaff('dentist'), A = await mkStaff('assistant');
const mkPatient = async (n, k) => (await call('POST', '/patients', { token: T, body: { firstName: n, lastName: `Payer${u}`, dateOfBirth: '1990-01-01', gender: 'male', phone: '+3749' + String(Date.now() + k).slice(-7) } })).data;
const p = await mkPatient('Anna', 1), p2 = await mkPatient('Bob', 2);
const inv = (body, token = R) => call('POST', '/billing/invoices', { token, body: { patientId: p._id, ...body } });
const pay = (id, body, token = R) => call('POST', `/billing/invoices/${id}/payments`, { token, body: { method: 'cash', ...body } });

// ── Create, totals, D3 ─────────────────────────────────────────────────────
r = await inv({ items: [{ description: 'Filling', unitPrice: 15000, discount: 10 }] });
const i1 = r.data;
check('draft created, 10% off 15000 = 13500', r.status === 201 && i1?.status === 'draft' && i1.totalAmount === 13500 && i1.discountTotal === 1500 && i1.balance === 13500, r.body);
check(`number INV-${year}-00001`, i1?.invoiceNumber === `INV-${year}-00001`, i1?.invoiceNumber);
check('populated patient, currency AMD', i1?.patientId?.firstName === 'Anna' && i1?.currency === 'AMD', i1?.patientId);
r = await inv({ items: [{ description: 'X', unitPrice: 100 }], currency: 'USD' });
check('other currency than the clinic -> currencyMismatch', r.status === 400 && r.body.code === 'currencyMismatch', r.body);
r = await inv({ items: [{ description: 'X', unitPrice: 100.5 }] });
check('half a dram -> amountPrecision', r.status === 400 && r.body.code === 'amountPrecision', r.body);
r = await inv({ items: [{ description: 'Free', unitPrice: 0 }], issue: true });
check('issuing a zero invoice -> invoiceEmpty', r.status === 400 && r.body.code === 'invoiceEmpty', r.body);

// ── Lifecycle & payments ───────────────────────────────────────────────────
r = await pay(i1._id, { amount: 1000 });
check('payment on a draft -> invoiceNotIssued', r.status === 400 && r.body.code === 'invoiceNotIssued', r.body);
r = await call('PATCH', `/billing/invoices/${i1._id}`, { token: R, body: { items: [{ description: 'Filling', unitPrice: 15000, discount: 10 }], dueDate: '2030-01-01', notes: 'n' } });
check('edit draft', r.status === 200 && r.data.dueDate?.startsWith('2030-01-01'), r.body);
r = await call('PATCH', `/billing/invoices/${i1._id}`, { token: R, body: { dueDate: '' } });
check('empty due date clears it', r.status === 200 && !r.data.dueDate, r.data);
r = await call('PATCH', `/billing/invoices/${i1._id}/issue`, { token: R });
check('issue', r.status === 200 && r.data.status === 'issued' && r.data.issuedBy?.firstName === 'receptionist', r.body);
r = await call('PATCH', `/billing/invoices/${i1._id}`, { token: R, body: { notes: 'late' } });
check('issued is not editable', r.status === 400 && r.body.code === 'invoiceNotEditable', r.body);
r = await pay(i1._id, { amount: 20000 });
check('over the balance -> paymentExceedsBalance (remaining 13500)', r.status === 400 && r.body.code === 'paymentExceedsBalance' && r.body.remaining === 13500, r.body);
r = await pay(i1._id, { amount: 100, currency: 'USD' });
check('payment currency must match -> currencyMismatch', r.status === 400 && r.body.code === 'currencyMismatch', r.body);
const race = await Promise.all([1, 2, 3].map(() => pay(i1._id, { amount: 5000 })));
const okRace = race.filter((x) => x.status === 201).length;
r = await call('GET', `/billing/invoices/${i1._id}`, { token: R });
check('3 parallel 5000 payments on 13500 -> exactly 2 accepted', okRace === 2 && r.data.paidAmount === 10000 && r.data.status === 'partial', { okRace, paid: r.data.paidAmount });
r = await pay(i1._id, { amount: 3500 });
check('exact remaining balance accepted -> paid', r.status === 201 && r.data.invoice.status === 'paid' && r.data.invoice.balance === 0 && r.data.payment.amount === 3500, r.body);
r = await pay(i1._id, { amount: 1 });
check('payment on paid -> invoiceAlreadyPaid', r.status === 400 && r.body.code === 'invoiceAlreadyPaid', r.body);
r = await call('PATCH', `/billing/invoices/${i1._id}/cancel`, { token: T, body: { reason: 'Changed mind' } });
check('cannot cancel with payments -> invoiceHasPayments', r.status === 400 && r.body.code === 'invoiceHasPayments', r.body);

// Refund
const payments = (await call('GET', `/billing/invoices/${i1._id}/payments`, { token: R })).data;
r = await call('PATCH', `/billing/invoices/${i1._id}/payments/${payments[0]._id}/void`, { token: R, body: { type: 'refund', reason: 'Returned' } });
check('receptionist cannot refund', r.status === 403, r.body);
r = await call('PATCH', `/billing/invoices/${i1._id}/payments/${payments[0]._id}/void`, { token: T, body: { type: 'refund', reason: 'Returned cash' } });
check('admin refund: paid back to 10000, partial', r.status === 200 && r.data.invoice.paidAmount === 10000 && r.data.invoice.status === 'partial' && r.data.payment.voidedBy?.firstName === 'Own', r.body);
r = await call('PATCH', `/billing/invoices/${i1._id}/payments/${payments[0]._id}/void`, { token: T, body: { type: 'refund', reason: 'Again' } });
check('refund twice -> paymentAlreadyVoided', r.status === 400 && r.body.code === 'paymentAlreadyVoided', r.body);
r = await call('GET', `/billing/invoices/${i1._id}/payments`, { token: D });
check('payments list keeps the voided one', r.data.length === 3 && r.data.filter((x) => x.voidedAt).length === 1, r.data?.length);

// Cancel rules
r = await inv({ items: [{ description: 'Exam', unitPrice: 5000 }], issue: true });
const i2 = r.data;
check('created issued', i2?.status === 'issued' && i2?.invoiceNumber === `INV-${year}-00002`, i2);
r = await call('PATCH', `/billing/invoices/${i2._id}/cancel`, { token: R, body: { reason: 'Mistake' } });
check('receptionist cannot cancel an issued invoice', r.status === 403 && r.body.code === 'cancelIssuedForbidden', r.body);
r = await call('PATCH', `/billing/invoices/${i2._id}/cancel`, { token: T, body: { reason: 'no' } });
check('cancel reason too short -> 400', r.status === 400, r.body);
r = await call('PATCH', `/billing/invoices/${i2._id}/cancel`, { token: T, body: { reason: 'Wrong patient' } });
check('admin cancels issued', r.status === 200 && r.data.status === 'cancelled' && r.data.cancelReason === 'Wrong patient' && r.data.cancelledBy?.firstName === 'Own', r.body);
r = await inv({ items: [{ description: 'Draft', unitPrice: 100 }] });
r = await call('PATCH', `/billing/invoices/${r.data._id}/cancel`, { token: R, body: { reason: 'Not needed' } });
check('receptionist cancels a draft', r.status === 200 && r.data.status === 'cancelled', r.body);

// Concurrent numbering
const many = await Promise.all([1, 2, 3, 4, 5].map(() => inv({ items: [{ description: 'Batch', unitPrice: 1000 }] })));
const numbers = many.map((x) => x.data?.invoiceNumber);
check('5 parallel invoices: all created, unique numbers', many.every((x) => x.status === 201) && new Set(numbers).size === 5, numbers);

// ── Roles ──────────────────────────────────────────────────────────────────
r = await call('GET', '/billing/invoices', { token: D });
check('dentist can view invoices', r.status === 200, r.body);
r = await inv({ items: [{ description: 'X', unitPrice: 1 }] }, D);
check('dentist cannot create invoices', r.status === 403, r.body);
r = await call('GET', '/billing/invoices', { token: A });
check('assistant has no billing access', r.status === 403, r.body);
r = await call('GET', '/reports/revenue', { token: R });
check('revenue: admin only', r.status === 403, r.body);
r = await call('GET', '/reports/revenue', { token: T });
check('revenue counts net payments (13500 paid, 3500 refunded)', r.status === 200 && r.data.collected === 10000 && r.data.currency === 'AMD', r.data);

// ── List: search, overdue, pages ──────────────────────────────────────────
r = await call('GET', `/billing/invoices?search=Payer${u}%20Anna`, { token: R });
check('search by patient name (two words)', r.status === 200 && r.data.pagination.total >= 8 && r.data.data.every((i) => i.patientId.firstName === 'Anna'), r.data?.pagination);
r = await call('GET', `/billing/invoices?search=INV-${year}-00002`, { token: R });
check('search by invoice number', r.data?.pagination?.total === 1, r.data?.pagination);
r = await call('GET', '/billing/invoices?search=(((', { token: R });
check('regex characters in search are safe', r.status === 200, r.body);
const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
r = await inv({ items: [{ description: 'Late', unitPrice: 2000 }], issue: true, dueDate: yesterday });
const late = r.data;
check('past due date -> isOverdue', late?.isOverdue === true, late);
r = await call('GET', '/billing/invoices?status=overdue', { token: R });
check('status=overdue filter', r.data?.data?.length === 1 && r.data.data[0]._id === late._id, r.data?.pagination);
r = await call('GET', '/billing/invoices?limit=500', { token: R });
check('limit > 100 -> 400', r.status === 400, r.body);

// ── Bill treatment entries ────────────────────────────────────────────────
const entry = (await call('POST', `/dental-records/${p._id}/treatment-entry`, { token: T, body: { teeth: [16], treatmentName: 'Filling', cost: 20000, currency: 'AMD' } })).data;
const planned = (await call('POST', `/dental-records/${p._id}/treatment-entry`, { token: T, body: { teeth: [17], treatmentName: 'Crown', status: 'planned' } })).data;
r = await call('GET', `/billing/patients/${p._id}/unbilled-treatments`, { token: R });
check('unbilled lists the done entry only', r.data?.length === 1 && r.data[0]._id === entry._id, r.data);
r = await inv({ items: [{ description: 'Filling 16', unitPrice: 20000, treatmentEntryId: entry._id }] });
const billed = r.data;
check('invoice from a treatment entry', r.status === 201 && billed.items[0].treatmentEntryId === entry._id, r.body);
r = await call('GET', `/billing/patients/${p._id}/unbilled-treatments`, { token: R });
check('billed entry leaves the unbilled list', r.data?.length === 0, r.data);
r = await inv({ items: [{ description: 'Again', unitPrice: 20000, treatmentEntryId: entry._id }] });
check('same entry twice -> treatmentAlreadyBilled', r.status === 409 && r.body.code === 'treatmentAlreadyBilled', r.body);
r = await inv({ items: [{ description: 'Planned', unitPrice: 1, treatmentEntryId: planned._id }] });
check('planned entry cannot be billed', r.status === 409 && r.body.code === 'treatmentAlreadyBilled', r.body);
r = await call('POST', '/billing/invoices', { token: R, body: { patientId: p2._id, items: [{ description: 'Other patient', unitPrice: 1, treatmentEntryId: entry._id }] } });
check("another patient's entry -> refused", r.status === 409, r.body);
r = await call('PATCH', `/dental-records/${p._id}/treatment-entry/${entry._id}/void`, { token: T, body: { reason: 'Mistake here' } });
check('billed entry cannot be voided', r.status === 400 && r.body.code === 'treatmentEntryBilled', r.body);
r = await call('PATCH', `/billing/invoices/${billed._id}`, { token: R, body: { items: [{ description: 'Something else', unitPrice: 100 }] } });
r = await call('GET', `/billing/patients/${p._id}/unbilled-treatments`, { token: R });
check('removing the line releases the entry', r.data?.length === 1, r.data);
r = await call('PATCH', `/billing/invoices/${billed._id}`, { token: R, body: { items: [{ description: 'Filling 16', unitPrice: 20000, treatmentEntryId: entry._id }] } });
r = await call('PATCH', `/billing/invoices/${billed._id}/cancel`, { token: R, body: { reason: 'Billed wrong' } });
r = await call('GET', `/billing/patients/${p._id}/unbilled-treatments`, { token: R });
check('cancelling the invoice releases the entry', r.data?.length === 1, r.data);

// ── Patient summary ───────────────────────────────────────────────────────
r = await call('GET', `/billing/patients/${p._id}/summary`, { token: D });
const amd = r.data?.byCurrency?.[0];
// issued/partial/paid only: i1 13500 (paid 10000) + late 2000 = 15500 billed
check('summary excludes drafts and cancelled', amd?.billed === 15500 && amd?.paid === 10000 && amd?.balance === 5500 && amd?.overdue === 1 && r.data.unbilledTreatments === 1, r.data);

// ── Tenancy ───────────────────────────────────────────────────────────────
r = await call('POST', '/auth/register', { body: { clinicName: `BillOther ${u}`, email: `bother-${u}@b.am`, password: 'ownerpass1', firstName: 'Ot', lastName: 'Her' } });
const OT = r.data.accessToken;
r = await call('GET', `/billing/invoices/${i1._id}`, { token: OT });
check('other clinic cannot read the invoice', r.status === 404, r.body);
r = await call('POST', `/billing/invoices/${i1._id}/payments`, { token: OT, body: { amount: 1, method: 'cash' } });
check('other clinic cannot pay it', r.status === 404, r.body);

// ── USD clinic: cents, no float drift ─────────────────────────────────────
r = await call('PATCH', '/clinics/current/settings', { token: OT, body: { currency: 'USD' } });
const op = (await call('POST', '/patients', { token: OT, body: { firstName: 'Usd', lastName: 'P', dateOfBirth: '1990-01-01', gender: 'male', phone: '+3749' + String(Date.now() + 9).slice(-7) } })).data;
r = await call('POST', '/billing/invoices', { token: OT, body: { patientId: op._id, items: [{ description: 'Cents', unitPrice: 0.1, quantity: 3 }], issue: true } });
const usd = r.data;
check('USD invoice 3 × 0.10 = 0.30', r.status === 201 && usd.currency === 'USD' && usd.totalAmount === 0.3, r.body);
r = await call('POST', `/billing/invoices/${usd._id}/payments`, { token: OT, body: { amount: 0.1, method: 'card' } });
r = await call('POST', `/billing/invoices/${usd._id}/payments`, { token: OT, body: { amount: 0.2, method: 'card' } });
check('0.10 + 0.20 pays 0.30 exactly', r.status === 201 && r.data.invoice.status === 'paid' && r.data.invoice.paidAmount === 0.3, r.body);
r = await call('POST', '/billing/invoices', { token: OT, body: { patientId: op._id, items: [{ description: 'Sub-cent', unitPrice: 0.001 }] } });
check('sub-cent price -> amountPrecision', r.status === 400 && r.body.code === 'amountPrecision', r.body);

console.log(out.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
