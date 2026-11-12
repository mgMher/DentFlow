import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, Staff, startApp, TestApp } from './app';

/** F7: who changed what — every write, field diffs on key records, sign-ins, document views. */
describe('Audit log (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let dentist: Staff, recep: Staff, assistant: Staff;
    let patient: any;

    const log = async (query = '', token = C.token) => (await t.api.get(`/audit?${query}`, token)).data.items as any[];
    const latest = async (query = '') => (await log(`limit=1&${query}`))[0];
    const history = async (patientId: string, token = C.token) =>
        (await t.api.get(`/patients/${patientId}/history?limit=200`, token)).data.items as any[];

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Audit');
        dentist = await t.addStaff(C, 'dentist');
        recep = await t.addStaff(C, 'receptionist');
        assistant = await t.addStaff(C, 'assistant');
        patient = await t.addPatient(recep.token, 'Audited');
    });
    afterAll(() => t.close());

    describe('changes to records', () => {
        it('logs a new patient with who, when, from where', async () => {
            const e = (await log(`patientId=${patient._id}`)).find((x) => x.event === 'patients.create');
            expect(e).toMatchObject({
                area: 'patients',
                method: 'POST',
                path: '/api/patients',
                targetId: patient._id,
                patientId: { _id: patient._id, firstName: 'Audited' },
                actor: { kind: 'staff', userId: recep.authId, name: 'receptionist Staff', role: 'receptionist' },
                details: { firstName: 'Audited' },
            });
            expect(e.ip).toBeTruthy();
            expect(new Date(e.at).getTime()).toBeGreaterThan(Date.now() - 60_000);
        });

        it('keeps the old and new value of each changed field, one level into objects; pictures masked', async () => {
            // Medical history is clinical: an admin edits it.
            const r = await t.api.patch(`/patients/${patient._id}`, C.token, {
                phone: '+37499123456',
                medicalHistory: { allergies: ['latex'] },
                photo: 'data:image/png;base64,AAAA',
                lastName: patient.lastName, // unchanged: not listed
            });
            expect(r.status).toBe(200);
            const e = await latest();
            expect(e.event).toBe('patients.update');
            expect(e.changes).toEqual(
                expect.arrayContaining([
                    { field: 'phone', from: patient.phone, to: '+37499123456' },
                    { field: 'medicalHistory.allergies', from: null, to: ['latex'] },
                    { field: 'photo', masked: true },
                ]),
            );
            expect(e.changes.map((c: any) => c.field)).not.toContain('lastName');
            expect(JSON.stringify(e)).not.toContain('AAAA');
        });

        it('status changes show from → to with the reason', async () => {
            const p = await t.addPatient(C.token, 'Leaving');
            await t.api.patch(`/patients/${p._id}/status`, C.token, { status: 'inactive', reason: 'Moved away' });
            expect(await latest()).toMatchObject({
                event: 'patients.updateStatus',
                changes: [{ field: 'status', from: 'active', to: 'inactive' }],
                details: { reason: 'Moved away', status: 'inactive' },
            });
        });

        it('a tooth change lists status, surfaces and notes of that tooth', async () => {
            const r = await t.api.patch(`/dental-records/${patient._id}/tooth`, dentist.token, {
                toothNumber: 36,
                status: 'healthy',
                surfaces: [{ surface: 'occlusal', status: 'decayed' }],
                notes: 'Watch',
            });
            expect(r.status).toBe(200);
            const e = await latest();
            expect(e).toMatchObject({ event: 'chart.updateTooth', area: 'chart', patientId: { _id: patient._id } });
            expect(e.changes).toEqual([
                { field: '36.surfaces', from: [], to: ['occlusal:decayed'] },
                { field: '36.notes', from: null, to: 'Watch' },
            ]);
        });

        it('money: invoice, payment and its void are logged on the patient with amounts and reason', async () => {
            const inv = (await t.api.post('/billing/invoices', recep.token, {
                patientId: patient._id,
                issue: true,
                items: [{ description: 'Filling', unitPrice: 20000 }],
            })).data;
            await t.api.post(`/billing/invoices/${inv._id}/payments`, recep.token, { method: 'cash', amount: 5000 });
            const payment = (await t.api.get(`/billing/invoices/${inv._id}/payments`, C.token)).data[0];
            const v = await t.api.patch(`/billing/invoices/${inv._id}/payments/${payment._id}/void`, C.token, {
                type: 'mistake',
                reason: 'Wrong amount',
            });
            expect(v.status).toBe(200);

            const events = (await history(patient._id)).filter((e) => e.area === 'billing');
            expect(events.map((e) => e.event)).toEqual(['billing.voidPayment', 'billing.addPayment', 'billing.createInvoice']);
            expect(events[2].details).toMatchObject({ invoiceNumber: inv.invoiceNumber });
            expect(events[1].details).toMatchObject({ amount: 5000, method: 'cash' });
            expect(events[1].changes).toEqual(
                expect.arrayContaining([{ field: 'paidAmount', from: 0, to: 5000 }, { field: 'status', from: 'issued', to: 'partial' }]),
            );
            expect(events[0]).toMatchObject({ targetId: payment._id, details: { reason: 'Wrong amount' } });
        });

        it('amounts read as people write them, not in cents', async () => {
            const usd = await t.registerClinic('Dollars');
            expect((await t.api.patch('/clinics/current/settings', usd.token, { currency: 'USD' })).status).toBe(200);
            const p = await t.addPatient(usd.token, 'Cents');
            const inv = (await t.api.post('/billing/invoices', usd.token, {
                patientId: p._id,
                issue: true,
                items: [{ description: 'Cleaning', unitPrice: 12.5 }],
            })).data;
            await t.api.post(`/billing/invoices/${inv._id}/payments`, usd.token, { method: 'card', amount: 10.25 });
            const e = (await t.api.get('/audit?limit=1', usd.token)).data.items[0];
            expect(e.event).toBe('billing.addPayment');
            expect(e.details).toMatchObject({ amount: 10.25, currency: 'USD' });
            expect(e.changes).toEqual(expect.arrayContaining([{ field: 'paidAmount', from: 0, to: 10.25 }]));
        });

        it('settings, staff and catalogue changes show old → new', async () => {
            await t.api.patch('/clinics/current/settings', C.token, { language: 'ru' });
            expect(await latest()).toMatchObject({ event: 'clinic.updateSettings', changes: [{ field: 'language', from: 'hy', to: 'ru' }] });

            await t.api.patch(`/users/${assistant.profile._id}`, C.token, { role: 'receptionist' });
            expect(await latest()).toMatchObject({
                event: 'staff.update',
                targetId: assistant.profile._id,
                changes: [{ field: 'role', from: 'assistant', to: 'receptionist' }],
            });

            const treatment = (await t.api.get('/treatments?limit=1', C.token)).data.data?.[0] ?? (await t.api.get('/treatments?limit=1', C.token)).data[0];
            await t.api.patch(`/treatments/${treatment._id}`, C.token, { price: { amount: treatment.price.amount + 1000, currency: 'AMD' } });
            const e = await latest();
            expect(e.event).toBe('catalog.update');
            expect(e.changes).toEqual([{ field: 'price.amount', from: treatment.price.amount, to: treatment.price.amount + 1000 }]);
        });

        it('a reschedule shows the old and new time', async () => {
            const start = new Date(Date.now() + 3 * 86_400_000);
            start.setUTCHours(8, 0, 0, 0);
            const end = new Date(start.getTime() + 30 * 60_000);
            const a = (await t.api.post('/appointments', recep.token, {
                patientId: patient._id,
                dentistId: dentist.authId,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                allowOutsideHours: true,
            })).data;
            const later = new Date(start.getTime() + 60 * 60_000);
            await t.api.patch(`/appointments/${a._id}`, recep.token, {
                startTime: later.toISOString(),
                endTime: new Date(later.getTime() + 30 * 60_000).toISOString(),
                allowOutsideHours: true,
            });
            const e = await latest();
            expect(e).toMatchObject({ event: 'appointments.update', patientId: { _id: patient._id } });
            expect(e.changes).toEqual(
                expect.arrayContaining([{ field: 'startTime', from: start.toISOString(), to: later.toISOString() }]),
            );
        });
    });

    describe('sign-ins and reads', () => {
        it('logs sign-ins and wrong passwords, never the password; unknown emails go nowhere', async () => {
            await t.login(dentist.email, 'staffpass1');
            expect(await latest('area=auth')).toMatchObject({
                event: 'auth.login',
                actor: { userId: dentist.authId, role: 'dentist' },
                details: { email: dentist.email },
            });
            await t.login(dentist.email, 'wrong-password');
            const failed = await latest('area=auth');
            expect(failed).toMatchObject({ event: 'auth.loginFailed', details: { email: dentist.email, reason: 'wrongPassword' } });
            expect(JSON.stringify(failed)).not.toContain('wrong-password');
            const before = (await log('area=auth&limit=200')).length;
            await t.login('nobody@e2e.test', 'whatever1');
            expect((await log('area=auth&limit=200')).length).toBe(before);
        });

        it('logs opening a document, but not ordinary reads, refreshes, failed writes or my notifications', async () => {
            const form = new FormData();
            form.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])], { type: 'image/jpeg' }), 'pano.jpg');
            form.append('kind', 'xray');
            const up = await fetch(`${t.url}/patients/${patient._id}/documents`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${dentist.token}` },
                body: form,
            }).then((r) => r.json());
            await fetch(`${t.url}/documents/${up.data._id}/file`, { headers: { Authorization: `Bearer ${recep.token}` } }).then((r) => r.arrayBuffer());
            expect(await latest()).toMatchObject({
                event: 'documents.file',
                method: 'GET',
                patientId: { _id: patient._id },
                actor: { userId: recep.authId },
                details: { title: 'pano.jpg' },
            });

            const count = (await log('limit=200')).length;
            await t.api.get(`/patients/${patient._id}`, recep.token);
            await t.api.get('/billing/invoices', recep.token);
            await t.api.patch(`/patients/${patient._id}`, recep.token, { gender: 'not-a-gender' }); // 400
            await t.api.patch(`/patients/${patient._id}/status`, recep.token, { status: 'archived' }); // 403
            await t.api.patch('/notifications/read-all', recep.token);
            await t.api.post('/auth/refresh', undefined, { refreshToken: C.refreshToken });
            expect((await log('limit=200')).length).toBe(count);
        });
    });

    describe('reading the log', () => {
        it('filters by person, area, patient and day; pages newest first', async () => {
            const byDentist = await log(`userId=${dentist.authId}&limit=200`);
            expect(byDentist.length).toBeGreaterThan(0);
            expect(byDentist.every((e) => e.actor.userId === dentist.authId)).toBe(true);
            expect((await log('area=chart&limit=200')).every((e) => e.area === 'chart')).toBe(true);

            const today = new Date().toISOString().slice(0, 10);
            expect((await log(`from=${today}&to=${today}&limit=200`)).length).toBeGreaterThan(5);
            expect(await log('from=2020-01-01&to=2020-01-31')).toEqual([]);

            const first = (await t.api.get('/audit?limit=3', C.token)).data;
            expect(first.items).toHaveLength(3);
            const second = (await t.api.get(`/audit?limit=3&before=${first.next}`, C.token)).data;
            expect(second.items[0]._id < first.items[2]._id).toBe(true);
            expect(new Set([...first.items, ...second.items].map((e: any) => e._id)).size).toBe(6);
        });

        it('admins see the clinic log; dentists a patient history; others nothing', async () => {
            expect((await t.api.get('/audit', dentist.token)).status).toBe(403);
            expect((await t.api.get('/audit', recep.token)).status).toBe(403);
            const h = await t.api.get(`/patients/${patient._id}/history`, dentist.token);
            expect(h.status).toBe(200);
            expect(h.data.items.every((e: any) => e.patientId._id === patient._id)).toBe(true);
            expect((await t.api.get(`/patients/${patient._id}/history`, recep.token)).status).toBe(403);
        });

        it("another clinic sees none of this clinic's entries", async () => {
            const other = await t.registerClinic('OtherAudit');
            const theirs = (await t.api.get('/audit?limit=200', other.token)).data.items;
            expect(theirs.length).toBeGreaterThan(0); // their own registration
            expect(theirs.every((e: any) => e.event === 'auth.register')).toBe(true);
            expect((await t.api.get(`/patients/${patient._id}/history`, other.token)).status).toBe(404);
            expect((await t.api.get(`/audit?patientId=${patient._id}`, other.token)).data.items).toEqual([]);
        });

        it('entries cannot be changed or deleted', async () => {
            const e = await latest();
            expect((await t.call('PATCH', `/audit/${e._id}`, { token: C.token, body: {} })).status).toBe(404);
            expect((await t.call('DELETE', `/audit/${e._id}`, { token: C.token })).status).toBe(404);
            const model = t.app.get<Model<any>>(getModelToken('AuditLog'));
            await expect(model.updateOne({ _id: e._id }, { $set: { event: 'x' } })).rejects.toThrow(/cannot be changed/);
            await expect(model.deleteMany({})).rejects.toThrow(/cannot be changed/);
            expect((await latest())._id).toBe(e._id);
        });
    });
});
