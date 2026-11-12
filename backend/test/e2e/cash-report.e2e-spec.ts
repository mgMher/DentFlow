import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice } from 'src/modules/billing/invoice.schema';
import { Clinic, Staff, startApp, TestApp } from './app';

/** F5: the day's money (Z-report), closing a day, and the debtors list. Amounts in AMD. */
describe('Cash report and debtors (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let recep: Staff, dentist: Staff, assistant: Staff;
    let invoiceModel: Model<Invoice>;

    /** Clinic day (Yerevan, UTC+4) `offset` days from today. */
    const clinicDay = (offset = 0) => new Date(Date.now() + 4 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
    const today = clinicDay();
    const report = async (date = today, token = C.token) => (await t.api.get(`/billing/cash-report?date=${date}`, token)).data;
    const invoice = async (patient: any, unitPrice: number) =>
        (await t.api.post('/billing/invoices', recep.token, { patientId: patient._id, issue: true, items: [{ description: 'Work', unitPrice }] })).data;
    const pay = (invoiceId: string, amount: number, method: string, token = recep.token, date?: string) =>
        t.api.post(`/billing/invoices/${invoiceId}/payments`, token, { amount, method, ...(date ? { date } : {}) });
    const method = (r: any, m: string) => r.byMethod.find((x: any) => x.method === m);

    beforeAll(async () => {
        t = await startApp();
        invoiceModel = t.app.get(getModelToken(Invoice.name));
        C = await t.registerClinic('Cash');
        recep = await t.addStaff(C, 'receptionist', 'Cashier');
        dentist = await t.addStaff(C, 'dentist');
        assistant = await t.addStaff(C, 'assistant');
    });
    afterAll(() => t.close());

    describe('the day report', () => {
        let refundedPaymentId: string;

        beforeAll(async () => {
            const p = await t.addPatient(C.token, 'Payer');
            const i1 = await invoice(p, 10000);
            const i2 = await invoice(p, 5000);
            const i3 = await invoice(p, 2000);
            const i4 = await invoice(p, 1000);
            refundedPaymentId = (await pay(i1._id, 10000, 'cash')).data.payment._id;
            const card = (await pay(i2._id, 5000, 'card')).data.payment._id;
            await t.api.post(`/billing/patients/${p._id}/payments`, recep.token, { amount: 3000, method: 'cash', allocations: [] });
            await pay(i3._id, 2000, 'bank_transfer', C.token);
            await pay(i4._id, 1000, 'cash', recep.token, clinicDay(-1));
            // The admin gives the 10 000 cash back today; the card payment was entered by mistake.
            await t.api.patch(`/billing/invoices/${i1._id}/payments/${refundedPaymentId}/void`, C.token, { type: 'refund', reason: 'Changed plan' });
            await t.api.patch(`/billing/invoices/${i2._id}/payments/${card}/void`, C.token, { type: 'mistake', reason: 'Wrong patient' });
        });

        it('totals: received (mistakes left out), refunded, net, on account', async () => {
            const r = await report();
            expect(r.date).toBe(today);
            expect(r.totals).toEqual({ received: 15000, refunded: 10000, net: 5000, count: 3, onAccount: 3000 });
        });

        it('by method, and the cash that should be in the drawer', async () => {
            const r = await report();
            expect(method(r, 'cash')).toMatchObject({ received: 13000, refunded: 10000, net: 3000, count: 2 });
            expect(method(r, 'card')).toMatchObject({ received: 0, count: 0 });
            expect(method(r, 'bank_transfer')).toMatchObject({ received: 2000, net: 2000 });
            expect(r.expectedCash).toBe(3000);
        });

        it('by cashier: who took it, and refunds under who gave it back', async () => {
            const r = await report();
            const cashier = r.byCashier.find((c: any) => c.name.includes('Cashier'));
            const owner = r.byCashier.find((c: any) => c.name.includes('Owner'));
            expect(cashier).toMatchObject({ received: 13000, refunded: 0, cash: 13000, count: 2 });
            expect(owner).toMatchObject({ received: 2000, refunded: 10000, cash: -10000, count: 1 });
        });

        it('lists the payments (the refunded one marked) and the refunds', async () => {
            const r = await report();
            expect(r.payments).toHaveLength(3);
            expect(r.payments.find((p: any) => p._id === refundedPaymentId).refunded).toBe(true);
            expect(r.payments.filter((p: any) => !p.invoiceNumber)).toHaveLength(1);
            expect(r.refunds).toHaveLength(1);
            expect(r.refunds[0]).toMatchObject({ amount: 10000, method: 'cash' });
        });

        it('a payment dated yesterday counts on yesterday', async () => {
            const y = await report(clinicDay(-1));
            expect(y.totals.received).toBe(1000);
            expect(y.totals.count).toBe(1);
        });
    });

    describe('closing the day', () => {
        it('records the counted cash and the difference', async () => {
            const r = await t.api.post('/billing/cash-report/close', recep.token, { date: today, countedCash: 2500, note: 'Short 500' });
            expect(r.status).toBe(201);
            expect(r.data.closure).toMatchObject({ countedCash: 2500, expectedCash: 3000, difference: -500, note: 'Short 500', changed: false });
            expect(r.data.closure.closedBy.firstName).toBe('Cashier');
        });

        it('cannot be closed twice, nor in the future', async () => {
            const again = await t.api.post('/billing/cash-report/close', recep.token, { date: today, countedCash: 3000 });
            expect(again.status).toBe(409);
            expect(again.body.code).toBe('dayAlreadyClosed');
            const future = await t.api.post('/billing/cash-report/close', recep.token, { date: clinicDay(2), countedCash: 0 });
            expect(future.body.code).toBe('dayInFuture');
        });

        it('a payment after closing is flagged as a change', async () => {
            const p = await t.addPatient(C.token, 'Late');
            const i = await invoice(p, 700);
            await pay(i._id, 700, 'cash');
            const r = await report();
            expect(r.closure.changed).toBe(true);
            expect(r.closure.expectedCash).toBe(3000);
            expect(r.expectedCash).toBe(3700);
        });

        it('only an admin can reopen; then it can be closed again', async () => {
            expect((await t.api.del(`/billing/cash-report/${today}/close`, recep.token)).status).toBe(403);
            const r = await t.api.del(`/billing/cash-report/${today}/close`, C.token);
            expect(r.status).toBe(200);
            expect(r.data.closure).toBeNull();
            expect((await t.api.del(`/billing/cash-report/${today}/close`, C.token)).body.code).toBe('dayNotClosed');
            const closed = await t.api.post('/billing/cash-report/close', recep.token, { date: today, countedCash: 3700 });
            expect(closed.data.closure.difference).toBe(0);
        });
    });

    describe('debtors', () => {
        let owes: any, paidUp: any, covered: any, old: any;

        beforeAll(async () => {
            owes = await t.addPatient(C.token, 'Owes');
            paidUp = await t.addPatient(C.token, 'PaidUp');
            covered = await t.addPatient(C.token, 'Covered');
            old = await t.addPatient(C.token, 'Old');
            const a = await invoice(owes, 30000);
            await pay(a._id, 10000, 'cash');
            const b = await invoice(paidUp, 4000);
            await pay(b._id, 4000, 'card');
            await invoice(covered, 6000);
            await t.api.post(`/billing/patients/${covered._id}/payments`, recep.token, { amount: 6000, method: 'cash', allocations: [] });
            const o = await invoice(old, 9000);
            // Issued 45 days ago, due 40 days ago.
            await invoiceModel.collection.updateOne(
                { _id: new Types.ObjectId(o._id) },
                { $set: { issuedAt: new Date(Date.now() - 45 * 86_400_000), dueDate: new Date(Date.now() - 40 * 86_400_000) } },
            );
        });

        it('lists who owes, net of their credit, largest first', async () => {
            const r = (await t.api.get('/billing/debtors', recep.token)).data;
            const names = r.debtors.map((d: any) => d.patient.firstName);
            expect(names).toContain('Owes');
            expect(names).toContain('Old');
            expect(names).not.toContain('PaidUp');
            expect(names).not.toContain('Covered');
            const o = r.debtors.find((d: any) => d.patient.firstName === 'Owes');
            expect(o).toMatchObject({ owed: 20000, credit: 0, net: 20000, invoices: 1 });
            expect(o.lastPayment).toBeTruthy();
            expect(r.debtors[0].net).toBeGreaterThanOrEqual(r.debtors[r.debtors.length - 1].net);
        });

        it('groups by age of debt; overdue only and minimum amount filter', async () => {
            const r = (await t.api.get('/billing/debtors', recep.token)).data;
            const o = r.debtors.find((d: any) => d.patient.firstName === 'Old');
            expect(o).toMatchObject({ overdue: true, daysOld: 40 });
            expect(o.byAge['31_60']).toBe(9000);
            expect(r.totals.byAge['31_60']).toBeGreaterThanOrEqual(9000);
            expect(r.totals.net).toBe(r.debtors.reduce((s: number, d: any) => s + d.net, 0));

            const overdue = (await t.api.get('/billing/debtors?overdueOnly=true', recep.token)).data;
            expect(overdue.debtors.map((d: any) => d.patient.firstName)).toEqual(['Old']);
            const big = (await t.api.get('/billing/debtors?minAmount=15000', recep.token)).data;
            expect(big.debtors.every((d: any) => d.net >= 15000)).toBe(true);
            const byAge = (await t.api.get('/billing/debtors?sort=age', recep.token)).data;
            expect(byAge.debtors[0].patient.firstName).toBe('Old');
        });
    });

    describe('roles and tenancy', () => {
        it('dentists and assistants see neither', async () => {
            for (const token of [dentist.token, assistant.token]) {
                expect((await t.api.get('/billing/cash-report', token)).status).toBe(403);
                expect((await t.api.get('/billing/debtors', token)).status).toBe(403);
            }
        });

        it("another clinic's report and debtors are its own", async () => {
            const other = await t.registerClinic('OtherCash');
            const r = await report(today, other.token);
            expect(r.totals.received).toBe(0);
            expect(r.closure).toBeNull();
            expect((await t.api.get('/billing/debtors', other.token)).data.debtors).toHaveLength(0);
        });

        it('rejects a bad date', async () => {
            expect((await t.api.get('/billing/cash-report?date=12-11-2026', C.token)).status).toBe(400);
            expect((await t.api.del('/billing/cash-report/yesterday/close', C.token)).status).toBe(400);
        });
    });
});
