import { Clinic, Staff, startApp, TestApp } from './app';

/** F11: dentist commission — % of money collected for their work, monthly, approved and locked by admins. */
describe('Dentist commission (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let d1: Staff, d2: Staff, recep: Staff;
    let patient: any;
    let paymentA: any, invoiceA: any;

    /** Months in the clinic's calendar (Yerevan, UTC+4). */
    const clinicNow = new Date(Date.now() + 4 * 3600_000);
    const monthOf = (back: number) => {
        const d = new Date(Date.UTC(clinicNow.getUTCFullYear(), clinicNow.getUTCMonth() - back, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    const M0 = monthOf(2); // two months ago
    const M1 = monthOf(1); // last month
    const NOW = monthOf(0);

    const get = async (month: string, token = C.token) => (await t.api.get(`/commission/${month}`, token)).data;
    const rowOf = (s: any, d: Staff) => s.rows.find((r: any) => r.dentistId === d.authId);

    /** A treatment done by `dentist`, invoiced and paid in full on `date`. */
    const paidWork = async (dentist: Staff, price: number, date: string, name: string) => {
        const entry = (
            await t.api.post(`/dental-records/${patient._id}/treatment-entry`, dentist.token, { teeth: [16], treatmentName: name, cost: price, currency: 'AMD' })
        ).data;
        const invoice = (
            await t.api.post('/billing/invoices', recep.token, {
                patientId: patient._id,
                issue: true,
                items: [{ description: name, unitPrice: price, treatmentEntryId: entry._id }],
            })
        ).data;
        const payment = (await t.api.post(`/billing/invoices/${invoice._id}/payments`, recep.token, { method: 'cash', amount: price, date })).data.payment;
        return { invoice, payment };
    };

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Commission');
        d1 = await t.addStaff(C, 'dentist', 'Ani');
        d2 = await t.addStaff(C, 'dentist', 'Bob');
        recep = await t.addStaff(C, 'receptionist');
        patient = await t.addPatient(C.token, 'Paying');
        ({ invoice: invoiceA, payment: paymentA } = await paidWork(d1, 10000, `${M0}-10`, 'Filling'));
        await paidWork(d2, 20000, `${M1}-10`, 'Crown');
    });
    afterAll(() => t.close());

    it('rates: a clinic default and per-dentist overrides (admins only)', async () => {
        expect((await t.api.put('/commission/rates', d1.token, { defaultRate: 99 })).status).toBe(403);
        const r = await t.api.put('/commission/rates', C.token, { defaultRate: 30, dentists: [{ dentistId: d2.authId, rate: 40 }] });
        expect(r.data.defaultRate).toBe(30);
        expect(r.data.dentists.find((d: any) => d.dentistId === d2.authId).rate).toBe(40);
        expect(r.data.dentists.find((d: any) => d.dentistId === d1.authId).rate).toBeNull();
        expect((await t.api.put('/commission/rates', C.token, { defaultRate: 101 })).status).toBe(400);
        expect((await t.api.put('/commission/rates', C.token, { dentists: [{ dentistId: recep.authId, rate: 10 }] })).status).toBe(404);
    });

    it('a live month: money collected for each dentist\'s work × their rate, with the lines behind it', async () => {
        const s = await get(M1);
        expect(s).toMatchObject({ month: M1, status: 'live', canApprove: true, ended: true, currency: 'AMD' });
        expect(rowOf(s, d2)).toMatchObject({ collected: 20000, rate: 40, commission: 8000, adjustment: 0, total: 8000 });
        expect(rowOf(s, d1)).toMatchObject({ collected: 0, rate: 30, commission: 0 });
        expect(s.lines).toEqual([expect.objectContaining({ dentistId: d2.authId, description: 'Crown', collected: 20000, commission: 8000, patient: expect.stringContaining('Paying') })]);
        expect(rowOf(await get(M0), d1)).toMatchObject({ collected: 10000, commission: 3000 });
    });

    it('a dentist sees only their own row and lines, and cannot approve', async () => {
        const s = await get(M1, d2.token);
        expect(s.ownOnly).toBe(true);
        expect(s.rows).toHaveLength(1);
        expect(s.rows[0]).toMatchObject({ dentistId: d2.authId, commission: 8000 });
        expect(s.unassigned).toBeUndefined();
        expect(s.canApprove).toBe(false);
        expect((await get(M1, d1.token)).lines).toEqual([]);
        expect((await t.api.post(`/commission/${M1}/approve`, d2.token)).status).toBe(403);
        expect((await t.api.get(`/commission/${M1}`, recep.token)).status).toBe(403);
    });

    it('only ended months can be approved; the future cannot be read', async () => {
        expect((await t.api.post(`/commission/${NOW}/approve`, C.token)).body.code).toBe('commissionMonthOpen');
        expect((await t.api.get(`/commission/${monthOf(-1)}`, C.token)).body.code).toBe('commissionMonthFuture');
        expect((await t.api.get('/commission/2026-13', C.token)).body.code).toBe('invalidMonth');
    });

    it('approving freezes the month: later rate changes do not touch it', async () => {
        expect((await t.api.post(`/commission/${M0}/approve`, C.token)).data).toEqual({ approved: true });
        expect((await t.api.post(`/commission/${M0}/approve`, C.token)).body.code).toBe('commissionApproved');
        await t.api.put('/commission/rates', C.token, { dentists: [{ dentistId: d1.authId, rate: 50 }] });
        const s = await get(M0);
        expect(s).toMatchObject({ status: 'approved', canApprove: false, canReopen: true, approvedBy: expect.stringContaining('Owner') });
        expect(rowOf(s, d1)).toMatchObject({ collected: 10000, rate: 30, commission: 3000, changedSince: 0 });
        await t.api.put('/commission/rates', C.token, { dentists: [{ dentistId: d1.authId, rate: null }] });
    });

    it('a refund after approval shows as a change, and is settled in the next approved month', async () => {
        const v = await t.api.patch(`/billing/invoices/${invoiceA._id}/payments/${paymentA._id}/void`, C.token, { type: 'refund', reason: 'Redone for free' });
        expect(v.status).toBe(200);
        expect(rowOf(await get(M0), d1)).toMatchObject({ commission: 3000, changedSince: -3000 });
        // Pending in the next unapproved month.
        expect(rowOf(await get(M1), d1)).toMatchObject({ commission: 0, adjustment: -3000, total: -3000 });

        await t.api.post(`/commission/${M1}/approve`, C.token);
        const m1 = await get(M1);
        expect(rowOf(m1, d1)).toMatchObject({ adjustment: -3000, total: -3000 });
        expect(m1.totals).toMatchObject({ commission: 8000, adjustment: -3000, total: 5000 });
        // Settled: M0 no longer shows a change, and the current month carries nothing.
        expect(rowOf(await get(M0), d1).changedSince).toBe(0);
        expect(rowOf(await get(NOW), d1).adjustment).toBe(0);
    });

    it('only the latest approved month can be reopened; reopening gives back what it settled', async () => {
        expect((await t.api.del(`/commission/${M0}/approve`, C.token)).body.code).toBe('commissionLaterApproved');
        expect((await t.api.del(`/commission/${M1}/approve`, C.token)).data).toEqual({ reopened: true });
        expect(rowOf(await get(M0), d1).changedSince).toBe(-3000);
        expect((await get(M1)).status).toBe('live');
        expect((await t.api.del(`/commission/${M1}/approve`, C.token)).body.code).toBe('commissionNotApproved');
    });

    it('approvals and rate changes are in the audit log; other clinics see nothing', async () => {
        const events = (await t.api.get('/audit?area=commission&limit=20', C.token)).data.items.map((e: any) => e.event);
        expect(events).toEqual(expect.arrayContaining(['commission.setRates', 'commission.approve', 'commission.reopen']));

        const other = await t.registerClinic('OtherCommission');
        const s = await get(M1, other.token);
        expect(s.rows).toEqual([]);
        expect(s.lines).toEqual([]);
        expect((await t.api.put('/commission/rates', other.token, { dentists: [{ dentistId: d1.authId, rate: 1 }] })).status).toBe(404);
    });
});
