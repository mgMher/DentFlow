import { Clinic, Staff, startApp, TestApp } from './app';

/**
 * Money must add up under concurrent requests: no overpayment, no lost
 * payment, a payment voided once, and the invoice status always follows the
 * amounts. Amounts are AMD, which has no minor unit.
 */
describe('Payments and invoice status (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let cashier: Staff, cashier2: Staff;
    let patient: any;

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Pay');
        cashier = await t.addStaff(C, 'receptionist', 'Cashier');
        cashier2 = await t.addStaff(C, 'receptionist', 'CashierTwo');
        patient = await t.addPatient(C.token);
    });
    afterAll(() => t.close());

    const invoice = async (unitPrice: number, issue = true) => {
        const r = await t.api.post('/billing/invoices', cashier.token, {
            patientId: patient._id,
            issue,
            items: [{ description: 'Treatment', unitPrice }],
        });
        expect(r.status).toBe(201);
        return r.data;
    };
    const pay = (id: string, amount: number, token = cashier.token) =>
        t.api.post(`/billing/invoices/${id}/payments`, token, { method: 'cash', amount });
    const get = async (id: string) => (await t.api.get(`/billing/invoices/${id}`, C.token)).data;
    const livePayments = async (id: string) =>
        ((await t.api.get(`/billing/invoices/${id}/payments`, C.token)).data as any[]).filter((p) => !p.voidedAt);
    const voidIt = (inv: string, payment: string, reason = 'Paid twice') =>
        t.api.patch(`/billing/invoices/${inv}/payments/${payment}/void`, C.token, { type: 'refund', reason });

    /** Paid amount on the invoice equals the sum of its live payments, and the status matches. */
    const expectConsistent = async (id: string) => {
        const inv = await get(id);
        const sum = (await livePayments(id)).reduce((s, p) => s + p.amount, 0);
        expect(inv.paidAmount).toBe(sum);
        expect(inv.paidAmount).toBeLessThanOrEqual(inv.totalAmount);
        const expected = inv.paidAmount >= inv.totalAmount ? 'paid' : inv.paidAmount > 0 ? 'partial' : 'issued';
        expect(inv.status).toBe(expected);
        return inv;
    };

    it('10 cashiers paying 3000 at once on 20000: exactly 6 accepted, never overpaid', async () => {
        const inv = await invoice(20000);
        const results = await Promise.all(
            Array.from({ length: 10 }, (_, i) => pay(inv._id, 3000, i % 2 ? cashier.token : cashier2.token)),
        );
        const accepted = results.filter((r) => r.status === 201);
        const refused = results.filter((r) => r.status !== 201);
        expect(accepted).toHaveLength(6);
        for (const r of refused) {
            expect(r.status).toBe(400);
            expect(r.body.code).toBe('paymentExceedsBalance');
        }
        const after = await expectConsistent(inv._id);
        expect(after.paidAmount).toBe(18000);
        expect(after.status).toBe('partial');
    });

    it('two cashiers taking the full balance at once: one wins, the invoice is paid once', async () => {
        const inv = await invoice(15000);
        const [a, b] = await Promise.all([pay(inv._id, 15000), pay(inv._id, 15000, cashier2.token)]);
        expect([a.status, b.status].sort()).toEqual([201, 400]);
        const after = await expectConsistent(inv._id);
        expect(after.status).toBe('paid');
        expect(await livePayments(inv._id)).toHaveLength(1);
    });

    it('a paid invoice takes no more payments; a refund reopens it', async () => {
        const inv = await invoice(5000);
        const first = await pay(inv._id, 5000);
        expect(first.status).toBe(201);
        expect(first.data.invoice.status).toBe('paid');

        const more = await pay(inv._id, 1);
        expect(more.status).toBe(400);

        const refund = await voidIt(inv._id, first.data.payment._id);
        expect(refund.status).toBe(200);
        expect(refund.data.invoice.status).toBe('issued');
        expect(refund.data.invoice.paidAmount).toBe(0);
        expect((await pay(inv._id, 5000)).status).toBe(201);
        await expectConsistent(inv._id);
    });

    it('voiding the same payment from five tabs at once takes it off once', async () => {
        const inv = await invoice(10000);
        const p1 = (await pay(inv._id, 4000)).data.payment;
        await pay(inv._id, 3000);

        const results = await Promise.all(Array.from({ length: 5 }, () => voidIt(inv._id, p1._id)));
        expect(results.filter((r) => r.status === 200)).toHaveLength(1);
        for (const r of results.filter((x) => x.status !== 200)) expect(r.body.code).toBe('paymentAlreadyVoided');

        const after = await expectConsistent(inv._id);
        expect(after.paidAmount).toBe(3000);
    });

    it('paying and voiding at the same time leaves amounts consistent', async () => {
        const inv = await invoice(10000);
        const p1 = (await pay(inv._id, 6000)).data.payment;
        // 6000 + 5000 would overpay unless the void lands first; either order must add up.
        const [voided, paid] = await Promise.all([voidIt(inv._id, p1._id), pay(inv._id, 5000, cashier2.token)]);
        expect(voided.status).toBe(200);
        expect([201, 400]).toContain(paid.status);
        await expectConsistent(inv._id);
    });

    it('receptionists cannot refund; only the admin can', async () => {
        const inv = await invoice(2000);
        const p = (await pay(inv._id, 2000)).data.payment;
        const r = await t.api.patch(`/billing/invoices/${inv._id}/payments/${p._id}/void`, cashier.token, {
            type: 'refund',
            reason: 'Asked for it',
        });
        expect(r.status).toBe(403);
        await expectConsistent(inv._id);
    });

    it('rejects zero, negative, fractional and wrong-currency amounts', async () => {
        const inv = await invoice(10000);
        for (const amount of [0, -100, 10.5]) {
            expect((await pay(inv._id, amount)).status).toBe(400);
        }
        const usd = await t.api.post(`/billing/invoices/${inv._id}/payments`, cashier.token, {
            method: 'cash',
            amount: 100,
            currency: 'USD',
        });
        expect(usd.status).toBe(400);
        expect(usd.body.code).toBe('currencyMismatch');
        const after = await expectConsistent(inv._id);
        expect(after.paidAmount).toBe(0);
    });

    describe('invoice status transitions', () => {
        it('draft: editable, not payable; issue makes it payable and frozen', async () => {
            const draft = await invoice(3000, false);
            expect(draft.status).toBe('draft');
            expect((await pay(draft._id, 1000)).status).toBe(400);

            const edit = await t.api.patch(`/billing/invoices/${draft._id}`, cashier.token, {
                items: [{ description: 'Changed', unitPrice: 4000 }],
            });
            expect(edit.status).toBe(200);
            expect(edit.data.totalAmount).toBe(4000);

            const issued = await t.api.patch(`/billing/invoices/${draft._id}/issue`, cashier.token);
            expect(issued.status).toBe(200);
            expect(issued.data.status).toBe('issued');

            const again = await t.api.patch(`/billing/invoices/${draft._id}/issue`, cashier.token);
            expect(again.status).toBe(400);
            expect(again.body.code).toBe('invoiceAlreadyIssued');

            const late = await t.api.patch(`/billing/invoices/${draft._id}`, cashier.token, { notes: 'too late' });
            expect(late.status).toBe(400);
            expect(late.body.code).toBe('invoiceNotEditable');
        });

        it('an empty draft cannot be issued', async () => {
            const draft = await invoice(0, false);
            const r = await t.api.patch(`/billing/invoices/${draft._id}/issue`, cashier.token);
            expect(r.status).toBe(400);
            expect(r.body.code).toBe('invoiceEmpty');
        });

        it('editing and issuing at once: the invoice is never changed after issue', async () => {
            const draft = await invoice(1000, false);
            const [edit, issue] = await Promise.all([
                t.api.patch(`/billing/invoices/${draft._id}`, cashier.token, { items: [{ description: 'Edited', unitPrice: 9000 }] }),
                t.api.patch(`/billing/invoices/${draft._id}/issue`, cashier2.token),
            ]);
            expect(issue.status).toBe(200);
            const final = await get(draft._id);
            expect(final.status).toBe('issued');
            // Either the edit landed before issue (and the issued total is 9000) or it was refused.
            if (edit.status === 200) expect(final.totalAmount).toBe(9000);
            else expect(final.totalAmount).toBe(1000);
        });

        it('cancel: a receptionist may cancel a draft; an issued one needs the admin; never with payments', async () => {
            const draft = await invoice(1000, false);
            const c1 = await t.api.patch(`/billing/invoices/${draft._id}/cancel`, cashier.token, { reason: 'Wrong patient' });
            expect(c1.status).toBe(200);
            expect(c1.data.status).toBe('cancelled');
            expect((await pay(draft._id, 100)).status).toBe(400);
            const twice = await t.api.patch(`/billing/invoices/${draft._id}/cancel`, C.token, { reason: 'Again' });
            expect(twice.body.code).toBe('invoiceCancelled');

            const issued = await invoice(1000);
            const byRecep = await t.api.patch(`/billing/invoices/${issued._id}/cancel`, cashier.token, { reason: 'Mistake' });
            expect(byRecep.status).toBe(403);

            await pay(issued._id, 500);
            const withPayment = await t.api.patch(`/billing/invoices/${issued._id}/cancel`, C.token, { reason: 'Mistake' });
            expect(withPayment.status).toBe(400);
            expect(withPayment.body.code).toBe('invoiceHasPayments');
        });

        it('paying and cancelling at once: never a cancelled invoice with money on it', async () => {
            const inv = await invoice(1000);
            const [paid, cancelled] = await Promise.all([
                pay(inv._id, 1000),
                t.api.patch(`/billing/invoices/${inv._id}/cancel`, C.token, { reason: 'Changed mind' }),
            ]);
            expect([paid.status, cancelled.status].filter((s) => s < 300)).toHaveLength(1);
            const final = await get(inv._id);
            if (final.status === 'cancelled') expect(final.paidAmount).toBe(0);
            else expect(final.status).toBe('paid');
        });

        it('parallel invoices get unique numbers', async () => {
            const many = await Promise.all(Array.from({ length: 8 }, () => invoice(100)));
            expect(new Set(many.map((i) => i.invoiceNumber)).size).toBe(8);
        });
    });
});
