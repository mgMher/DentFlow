import { Clinic, Staff, startApp, TestApp } from './app';

/**
 * F4: the patient's account. Amounts in AMD (no minor unit). The invariant
 * throughout: money received = money on invoices + credit, and no invoice
 * is ever paid past its total.
 */
describe('Patient account (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let recep: Staff, dentist: Staff, assistant: Staff;

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Account');
        recep = await t.addStaff(C, 'receptionist');
        dentist = await t.addStaff(C, 'dentist');
        assistant = await t.addStaff(C, 'assistant');
    });
    afterAll(() => t.close());

    const invoice = async (patient: any, unitPrice: number) => {
        const r = await t.api.post('/billing/invoices', recep.token, {
            patientId: patient._id,
            issue: true,
            items: [{ description: 'Work', unitPrice }],
        });
        expect(r.status).toBe(201);
        return r.data;
    };
    const account = async (patient: any) => (await t.api.get(`/billing/patients/${patient._id}/account`, recep.token)).data;
    const pay = (patient: any, body: Record<string, unknown>, token = recep.token) =>
        t.api.post(`/billing/patients/${patient._id}/payments`, token, { method: 'cash', ...body });
    const inv = async (id: string) => (await t.api.get(`/billing/invoices/${id}`, C.token)).data;
    /** Money received (live payments) must equal what sits on invoices plus credit. */
    const expectBalanced = async (patient: any, invoiceIds: string[]) => {
        const acct = await account(patient);
        const onInvoices = (await Promise.all(invoiceIds.map(inv))).reduce((s, i) => s + i.paidAmount, 0);
        const statement = (await t.api.get(`/billing/patients/${patient._id}/statement`, recep.token)).data;
        const received = statement.lines.reduce((s: number, l: any) => s + l.payment, 0);
        expect(received).toBe(onInvoices + acct.credit);
        expect(statement.balance).toBe(acct.balance);
        for (const id of invoiceIds) {
            const i = await inv(id);
            expect(i.paidAmount).toBeLessThanOrEqual(i.totalAmount);
        }
        return acct;
    };

    describe('one payment over several invoices', () => {
        let p: any, i1: any, i2: any, i3: any;
        beforeAll(async () => {
            p = await t.addPatient(C.token, 'Multi');
            i1 = await invoice(p, 10000);
            i2 = await invoice(p, 20000);
            i3 = await invoice(p, 15000);
        });

        it('the account lists open invoices oldest first', async () => {
            const a = await account(p);
            expect(a).toMatchObject({ currency: 'AMD', outstanding: 45000, credit: 0, balance: 45000 });
            expect(a.openInvoices.map((x: any) => x.invoiceNumber)).toEqual([i1.invoiceNumber, i2.invoiceNumber, i3.invoiceNumber]);
        });

        it('pays the oldest invoices first', async () => {
            const r = await pay(p, { amount: 25000 });
            expect(r.status).toBe(201);
            expect(r.data.paid).toEqual([
                { invoiceId: i1._id, amount: 10000 },
                { invoiceId: i2._id, amount: 15000 },
            ]);
            expect(r.data.credit).toBe(0);
            expect((await inv(i1._id)).status).toBe('paid');
            expect((await inv(i2._id)).status).toBe('partial');
        });

        it('what is left over after every invoice becomes credit', async () => {
            const r = await pay(p, { amount: 30000 });
            expect(r.data.paid.map((x: any) => x.amount)).toEqual([5000, 15000]);
            expect(r.data.credit).toBe(10000);
            const a = await expectBalanced(p, [i1._id, i2._id, i3._id]);
            expect(a).toMatchObject({ outstanding: 0, credit: 10000, balance: -10000 });
            expect(a.credits).toHaveLength(1);
        });

        it('the admin is told about the payment', async () => {
            const note = (await t.api.get('/notifications?limit=1', C.token)).data.data[0];
            expect(note).toMatchObject({ type: 'payment_received', relatedType: 'patient' });
            expect(note.data).toMatchObject({ amount: 30000, onAccount: 10000 });
        });
    });

    describe('explicit splits and advance payments', () => {
        let p: any, a: any, b: any;
        beforeAll(async () => {
            p = await t.addPatient(C.token, 'Split');
            a = await invoice(p, 8000);
            b = await invoice(p, 6000);
        });

        it('splits as asked; the rest goes on account', async () => {
            const r = await pay(p, { amount: 5000, allocations: [{ invoiceId: b._id, amount: 3000 }] });
            expect(r.data.paid).toEqual([{ invoiceId: b._id, amount: 3000 }]);
            expect(r.data.credit).toBe(2000);
            expect((await inv(a._id)).paidAmount).toBe(0);
        });

        it('refuses more than a balance, parts above the payment, closed or foreign invoices', async () => {
            const over = await pay(p, { amount: 9000, allocations: [{ invoiceId: b._id, amount: 4000 }] });
            expect(over.body.code).toBe('paymentExceedsBalance');
            const sum = await pay(p, { amount: 1000, allocations: [{ invoiceId: a._id, amount: 2000 }] });
            expect(sum.body.code).toBe('allocationExceedsPayment');
            const other = await t.addPatient(C.token, 'Stranger');
            const foreign = await invoice(other, 1000);
            const notHers = await pay(p, { amount: 1000, allocations: [{ invoiceId: foreign._id, amount: 1000 }] });
            expect(notHers.body.code).toBe('invoiceNotOpen');
            expect((await pay(p, { amount: 100.5 })).body.code).toBe('amountPrecision');
            // Nothing above was recorded.
            expect((await account(p)).credit).toBe(2000);
        });

        it('an advance payment with no invoice at all', async () => {
            const fresh = await t.addPatient(C.token, 'Advance');
            const r = await pay(fresh, { amount: 50000, allocations: [] });
            expect(r.data).toMatchObject({ paid: [], credit: 50000 });
            expect(await account(fresh)).toMatchObject({ outstanding: 0, credit: 50000, balance: -50000 });
        });
    });

    describe('using credit', () => {
        let p: any, big: any, small: any;
        beforeAll(async () => {
            p = await t.addPatient(C.token, 'Credit');
            await pay(p, { amount: 30000, allocations: [] });
            big = await invoice(p, 12000);
            small = await invoice(p, 25000);
        });

        it('applies part of the credit to an invoice (the credit is split)', async () => {
            const r = await t.api.post(`/billing/invoices/${big._id}/apply-credit`, recep.token, {});
            expect(r.status).toBe(200);
            expect(r.data.applied).toBe(12000);
            expect(r.data.account.credit).toBe(18000);
            expect((await inv(big._id)).status).toBe('paid');
            const payments = (await t.api.get(`/billing/invoices/${big._id}/payments`, recep.token)).data;
            expect(payments).toHaveLength(1);
            expect(payments[0].appliedAt).toBeDefined();
        });

        it('cannot apply more than the credit or the balance', async () => {
            const tooMuch = await t.api.post(`/billing/invoices/${small._id}/apply-credit`, recep.token, { amount: 20000 });
            expect(tooMuch.body.code).toBe('creditInsufficient');
            const paidInvoice = await t.api.post(`/billing/invoices/${big._id}/apply-credit`, recep.token, {});
            expect(paidInvoice.body.code).toBe('invoiceNotOpen');
        });

        it('voiding applied credit as a mistake returns it to credit', async () => {
            const [applied] = (await t.api.get(`/billing/invoices/${big._id}/payments`, C.token)).data;
            const r = await t.api.patch(`/billing/invoices/${big._id}/payments/${applied._id}/void`, C.token, {
                type: 'mistake',
                reason: 'Wrong invoice',
            });
            expect(r.status).toBe(200);
            expect(r.data.returnedToCredit).toBe(true);
            expect(r.data.invoice.status).toBe('issued');
            expect((await account(p)).credit).toBe(30000);
            await expectBalanced(p, [big._id, small._id]);
        });

        it('the rest of the invoice can still be paid in cash after credit', async () => {
            await t.api.post(`/billing/invoices/${small._id}/apply-credit`, recep.token, { amount: 10000 });
            const r = await pay(p, { amount: 15000, allocations: [{ invoiceId: small._id, amount: 15000 }] });
            expect(r.status).toBe(201);
            expect((await inv(small._id)).status).toBe('paid');
            await expectBalanced(p, [big._id, small._id]);
        });

        it('only an admin refunds credit; refunded credit is gone', async () => {
            const before = await account(p);
            const [credit] = before.credits;
            const byRecep = await t.api.patch(`/billing/patients/${p._id}/credits/${credit._id}/void`, recep.token, {
                type: 'refund',
                reason: 'Moving away',
            });
            expect(byRecep.status).toBe(403);
            const r = await t.api.patch(`/billing/patients/${p._id}/credits/${credit._id}/void`, C.token, {
                type: 'refund',
                reason: 'Moving away',
            });
            expect(r.status).toBe(200);
            expect(r.data.credit).toBe(before.credit - credit.amount);
            const again = await t.api.patch(`/billing/patients/${p._id}/credits/${credit._id}/void`, C.token, {
                type: 'refund',
                reason: 'Twice',
            });
            expect(again.body.code).toBe('paymentAlreadyVoided');
        });

        it('the statement tells the whole story with a running balance', async () => {
            const s = (await t.api.get(`/billing/patients/${p._id}/statement`, recep.token)).data;
            expect(s.lines.map((l: any) => l.type)).toEqual(
                expect.arrayContaining(['payment', 'invoice', 'payment_voided']),
            );
            const last = s.lines[s.lines.length - 1];
            expect(last.balance).toBe(s.balance);
            expect(s.balance).toBe((await account(p)).balance);
            expect(s.lines.find((l: any) => l.type === 'payment' && l.onAccount)).toBeDefined();
        });
    });

    it('a payment taken today comes after the invoices it pays on the statement', async () => {
        const p = await t.addPatient(C.token, 'Order');
        await invoice(p, 4000);
        await pay(p, { amount: 6000 });
        const lines = (await t.api.get(`/billing/patients/${p._id}/statement`, recep.token)).data.lines;
        expect(lines.map((l: any) => [l.type, l.balance])).toEqual([
            ['invoice', 4000],
            ['payment', 0],
            ['payment', -2000],
        ]);
    });

    describe('races', () => {
        it('two cashiers paying the same invoices at once never overpay', async () => {
            const p = await t.addPatient(C.token, 'Racer');
            const x = await invoice(p, 10000);
            const y = await invoice(p, 10000);
            const results = await Promise.all([pay(p, { amount: 15000 }), pay(p, { amount: 15000 }, C.token)]);
            for (const r of results) expect([201, 409]).toContain(r.status);
            for (const r of results.filter((x) => x.status === 409)) expect(r.body.code).toBe('invoiceBalanceChanged');
            await expectBalanced(p, [x._id, y._id]);
        });

        it('using the same credit twice at once never spends more than there is', async () => {
            const p = await t.addPatient(C.token, 'Spender');
            await pay(p, { amount: 10000, allocations: [] });
            const u = await invoice(p, 10000);
            const v = await invoice(p, 10000);
            const results = await Promise.all([
                t.api.post(`/billing/invoices/${u._id}/apply-credit`, recep.token, {}),
                t.api.post(`/billing/invoices/${v._id}/apply-credit`, C.token, {}),
            ]);
            const applied = results.filter((r) => r.status === 200).reduce((s, r) => s + r.data.applied, 0);
            expect(applied).toBe(10000);
            const acct = await expectBalanced(p, [u._id, v._id]);
            expect(acct.credit).toBe(0);
        });
    });

    describe('reports, roles and tenancy', () => {
        it('revenue counts money on account as collected, and says how much is on account', async () => {
            // The clinic's day (Yerevan, UTC+4), not UTC: they differ between midnight and 4 a.m.
            const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
            const r = await t.api.get(`/reports/revenue?startDate=${today}&endDate=${today}`, C.token);
            expect(r.status).toBe(200);
            expect(r.data.onAccount).toBeGreaterThan(0);
            expect(r.data.collected).toBeGreaterThanOrEqual(r.data.onAccount);
            const perf = await t.api.get(`/reports/dentist-performance?startDate=${today}&endDate=${today}`, C.token);
            const dentists = perf.data.dentists ?? perf.data.rows ?? [];
            const attributed = dentists.reduce((s: number, d: any) => s + (d.collected ?? 0), 0);
            // On-account money is not anyone's work yet: it sits in "unassigned", and the parts still add up.
            expect(Math.round(attributed + perf.data.unassignedCollected)).toBe(Math.round(r.data.collected));
        });

        it('dentists can look but not take money; assistants see nothing', async () => {
            const p = await t.addPatient(C.token, 'Roles');
            expect((await t.api.get(`/billing/patients/${p._id}/account`, dentist.token)).status).toBe(200);
            expect((await pay(p, { amount: 1000 }, dentist.token)).status).toBe(403);
            expect((await t.api.get(`/billing/patients/${p._id}/account`, assistant.token)).status).toBe(403);
        });

        it("another clinic cannot see or pay this clinic's patients", async () => {
            const p = await t.addPatient(C.token, 'Private');
            const i = await invoice(p, 5000);
            const other = await t.registerClinic('OtherAccount');
            expect((await t.api.get(`/billing/patients/${p._id}/account`, other.token)).status).toBe(404);
            expect((await t.api.get(`/billing/patients/${p._id}/statement`, other.token)).status).toBe(404);
            expect((await pay(p, { amount: 5000 }, other.token)).status).toBe(404);
            expect((await t.api.post(`/billing/invoices/${i._id}/apply-credit`, other.token, {})).status).toBe(404);
            expect((await inv(i._id)).paidAmount).toBe(0);
        });
    });
});
