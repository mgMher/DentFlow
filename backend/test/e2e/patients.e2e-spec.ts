import { at, Clinic, Staff, startApp, TestApp } from './app';

describe('Patients (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let dentist: Staff;

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Patients');
        dentist = await t.addStaff(C, 'dentist');
    });
    afterAll(() => t.close());

    const create = (firstName: string, email?: string) =>
        t.api.post('/patients', C.token, {
            firstName,
            lastName: 'Family',
            dateOfBirth: '2016-05-01',
            gender: 'female',
            phone: '+3749' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7),
            ...(email ? { email } : {}),
        });

    it('siblings may share a parent email (D4), on a fresh database too', async () => {
        const email = `parent-${Date.now()}@e2e.test`;
        expect((await create('First', email)).status).toBe(201);
        const second = await create('Second', email);
        expect(second.status).toBe(201);
        const dupes = await t.api.get(`/patients/duplicates?email=${encodeURIComponent(email)}`, C.token);
        expect(dupes.status).toBe(200);
        expect(JSON.stringify(dupes.data)).toContain('First');
    });

    it('archiving with "cancel upcoming" frees the slots; an archived patient cannot be booked or billed', async () => {
        const p = (await create('Leaving')).data;
        const booked = await t.api.post('/appointments', C.token, {
            patientId: p._id,
            dentistId: dentist.authId,
            startTime: at(4, 8),
            endTime: at(4, 8, 30),
            allowOutsideHours: true,
        });
        expect(booked.status).toBe(201);

        const archived = await t.api.patch(`/patients/${p._id}/status`, C.token, {
            status: 'archived',
            reason: 'Moved away',
            cancelUpcomingAppointments: true,
        });
        expect(archived.status).toBe(200);
        expect(archived.data.cancelledAppointments).toBe(1);
        const appt = await t.api.get(`/appointments/${booked.data._id}`, C.token);
        expect(appt.data.status).toBe('cancelled');
        expect(appt.data.cancelReason).toBe('patient_left');

        const book = await t.api.post('/appointments', C.token, {
            patientId: p._id,
            dentistId: dentist.authId,
            startTime: at(5, 8),
            endTime: at(5, 8, 30),
            allowOutsideHours: true,
        });
        expect(book.status).toBe(400);
        expect(book.body.code).toBe('patientClosed');
        const bill = await t.api.post('/billing/invoices', C.token, { patientId: p._id, items: [{ description: 'x', unitPrice: 100 }] });
        expect(bill.status).toBe(400);
        expect(bill.body.code).toBe('patientClosed');

        const back = await t.api.patch(`/patients/${p._id}/status`, C.token, { status: 'active' });
        expect(back.status).toBe(200);
        const history = (await t.api.get(`/patients/${p._id}`, C.token)).data.statusHistory.map((h: any) => h.to);
        expect(history).toEqual(['active', 'archived', 'active']);
    });

    it('two status changes at once: the history stays one unbroken chain', async () => {
        const p = (await create('Racing')).data;
        const results = await Promise.all([
            t.api.patch(`/patients/${p._id}/status`, C.token, { status: 'inactive' }),
            t.api.patch(`/patients/${p._id}/status`, C.token, { status: 'archived' }),
        ]);
        // Overlapping, one gets 409 patientStatusChanged; one after the other, both are fine.
        const ok = results.filter((r) => r.status === 200);
        expect(ok.length).toBeGreaterThanOrEqual(1);
        for (const r of results.filter((x) => x.status !== 200)) expect(r.body.code).toBe('patientStatusChanged');

        const history = (await t.api.get(`/patients/${p._id}`, C.token)).data.statusHistory;
        expect(history).toHaveLength(1 + ok.length);
        for (let i = 1; i < history.length; i++) expect(history[i].from).toBe(history[i - 1].to);
    });

    it('unknown patient ids are 404 on every per-patient read', async () => {
        const ghost = '0123456789abcdef01234567';
        for (const path of [
            `/patients/${ghost}`,
            `/patients/${ghost}/upcoming-appointments`,
            `/billing/patients/${ghost}/summary`,
            `/billing/patients/${ghost}/unbilled-treatments`,
            `/dental-records/${ghost}/treatment-history`,
        ]) {
            const r = await t.api.get(path, C.token);
            expect([path, r.status, r.body.code]).toEqual([path, 404, 'patientNotFound']);
        }
        expect((await t.api.get('/patients/not-an-id', C.token)).status).toBe(400);
    });
});
