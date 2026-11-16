import { Clinic, Staff, startApp, TestApp } from './app';

/** F10: fiscal receipt numbers from the clinic's own cash register (ՀԴՄ), recorded against payments. */
describe('Fiscal receipt numbers (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let recep: Staff, dentist: Staff, assistant: Staff;
    let patient: any;

    const invoice = async (unitPrice: number, p = patient) =>
        (await t.api.post('/billing/invoices', recep.token, { patientId: p._id, issue: true, items: [{ description: 'Work', unitPrice }] })).data;
    const pay = (inv: any, amount: number, extra: Record<string, unknown> = {}) =>
        t.api.post(`/billing/invoices/${inv._id}/payments`, recep.token, { method: 'cash', amount, ...extra });
    const list = async (query = '') => (await t.api.get(`/billing/fiscal-receipts?${query}`, recep.token)).data;
    const setNumber = (paymentId: string, fiscalNumber: string | null, token = recep.token) =>
        t.api.patch(`/billing/payments/${paymentId}/fiscal`, token, { fiscalNumber });

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Fiscal');
        recep = await t.addStaff(C, 'receptionist');
        dentist = await t.addStaff(C, 'dentist');
        assistant = await t.addStaff(C, 'assistant');
        patient = await t.addPatient(C.token, 'Receipt');
    });
    afterAll(() => t.close());

    it('a number given with the payment is stored, with who and when', async () => {
        const inv = await invoice(10000);
        const r = await pay(inv, 10000, { fiscalNumber: '  12 345  678 ' });
        expect(r.status).toBe(201);
        expect(r.data.payment).toMatchObject({ fiscalNumber: '12 345 678', fiscalRecordedBy: recep.authId });
        const recorded = await list('status=recorded');
        expect(recorded.items[0]).toMatchObject({ fiscalNumber: '12 345 678', amount: 10000, method: 'cash', invoices: [{ invoiceNumber: inv.invoiceNumber }] });
    });

    it('payments without one are listed as missing; a number can be added, changed and cleared', async () => {
        const inv = await invoice(7000);
        const payment = (await pay(inv, 7000)).data.payment;
        const missing = await list();
        expect(missing.items[0]).toMatchObject({ paymentIds: [payment._id], fiscalNumber: null, amount: 7000, patient: { firstName: 'Receipt' } });
        expect(missing.counts.missing).toBeGreaterThanOrEqual(1);

        expect((await setNumber(payment._id, '555-1')).data).toMatchObject({ fiscalNumber: '555-1', amount: 7000 });
        expect((await list()).items.find((r: any) => r.paymentIds.includes(payment._id))).toBeUndefined();
        expect((await setNumber(payment._id, '555-2')).data.fiscalNumber).toBe('555-2');
        expect((await setNumber(payment._id, null)).data.fiscalNumber).toBeNull();
        expect((await list()).items[0].paymentIds).toEqual([payment._id]);
    });

    it('one payment over several invoices is one receipt: one number covers every part', async () => {
        const a = await invoice(3000);
        const b = await invoice(2000);
        const r = await t.api.post(`/billing/patients/${patient._id}/payments`, recep.token, {
            amount: 6000,
            method: 'card',
            allocations: [
                { invoiceId: a._id, amount: 3000 },
                { invoiceId: b._id, amount: 2000 },
            ],
        });
        expect(r.status).toBe(201);
        const receipt = (await list()).items[0];
        expect(receipt).toMatchObject({ amount: 6000, method: 'card', onAccount: true });
        expect(receipt.paymentIds).toHaveLength(3);
        expect(receipt.invoices.map((i: any) => i.invoiceNumber).sort()).toEqual([a.invoiceNumber, b.invoiceNumber].sort());

        await setNumber(receipt.paymentIds[1], 'MULTI-9');
        const parts = [
            ...(await t.api.get(`/billing/invoices/${a._id}/payments`, recep.token)).data,
            ...(await t.api.get(`/billing/invoices/${b._id}/payments`, recep.token)).data,
        ];
        expect(parts.every((p: any) => p.fiscalNumber === 'MULTI-9')).toBe(true);
        expect((await t.api.get(`/billing/patients/${patient._id}/account`, recep.token)).data.credit).toBe(1000);
    });

    it('a number already on another payment is refused; the same receipt may repeat it', async () => {
        const inv = await invoice(1000);
        const p = (await pay(inv, 500)).data.payment;
        const used = await setNumber(p._id, 'MULTI-9');
        expect(used.status).toBe(409);
        expect(used.body.code).toBe('fiscalNumberUsed');
        expect((await pay(inv, 500, { fiscalNumber: '12 345 678' })).body.code).toBe('fiscalNumberUsed');
        await setNumber(p._id, 'SOLO-1');
        expect((await setNumber(p._id, 'SOLO-1')).status).toBe(200);
    });

    it('refuses odd characters and overly long numbers', async () => {
        const inv = await invoice(1000);
        const p = (await pay(inv, 1000)).data.payment;
        expect((await setNumber(p._id, '№12')).status).toBe(400);
        expect((await setNumber(p._id, 'x'.repeat(41))).status).toBe(400);
        expect((await t.api.patch(`/billing/payments/${p._id}/fiscal`, recep.token, {})).status).toBe(400);
    });

    it('a payment voided as a mistake leaves the list; a refunded one stays, marked refunded', async () => {
        const inv = await invoice(4000);
        const mistake = (await pay(inv, 1000)).data.payment;
        const refund = (await pay(inv, 2000)).data.payment;
        await t.api.patch(`/billing/invoices/${inv._id}/payments/${mistake._id}/void`, C.token, { type: 'mistake', reason: 'Typed twice' });
        await t.api.patch(`/billing/invoices/${inv._id}/payments/${refund._id}/void`, C.token, { type: 'refund', reason: 'Gave back' });
        const all = (await list('status=all&limit=500')).items;
        expect(all.find((r: any) => r.paymentIds.includes(mistake._id))).toBeUndefined();
        expect(all.find((r: any) => r.paymentIds.includes(refund._id))).toMatchObject({ refunded: true });
    });

    it('the day report counts receipts still without a number and shows the numbers', async () => {
        const report = (await t.api.get('/billing/cash-report', recep.token)).data;
        const missing = (await list('status=missing&limit=500')).counts.missing;
        // The report counts today's money, refunds included, mistakes excluded: same rule as the list.
        expect(report.totals.fiscalMissing).toBe(missing);
        expect(report.payments.some((p: any) => p.fiscalNumber === '12 345 678')).toBe(true);
    });

    it('filters by day', async () => {
        expect((await list('status=all&from=2020-01-01&to=2020-01-31')).items).toEqual([]);
        // The clinic's day (Yerevan, UTC+4), not UTC: they differ between midnight and 4 a.m.
        const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
        expect((await list(`status=all&from=${today}&to=${today}`)).items.length).toBeGreaterThan(0);
    });

    it('only those who take payments see or change numbers; other clinics nothing; changes are audited', async () => {
        expect((await t.api.get('/billing/fiscal-receipts', dentist.token)).status).toBe(403);
        expect((await t.api.get('/billing/fiscal-receipts', assistant.token)).status).toBe(403);
        const inv = await invoice(900);
        const p = (await pay(inv, 900)).data.payment;
        expect((await setNumber(p._id, 'X1', dentist.token)).status).toBe(403);

        const other = await t.registerClinic('OtherFiscal');
        expect((await setNumber(p._id, 'X1', other.token)).status).toBe(404);
        expect((await t.api.get('/billing/fiscal-receipts?status=all', other.token)).data.items).toEqual([]);

        await setNumber(p._id, 'AUD-1');
        const log = (await t.api.get('/audit?area=billing&limit=1', C.token)).data.items[0];
        expect(log).toMatchObject({ event: 'billing.setFiscalNumber', patientId: { _id: patient._id }, changes: [{ field: 'fiscalNumber', from: null, to: 'AUD-1' }] });
    });
});
