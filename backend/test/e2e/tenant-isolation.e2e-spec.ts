import { at, Clinic, Staff, startApp, TestApp } from './app';

/**
 * Clinic B must not read, change or reference anything of clinic A's, by id
 * in the URL or in the body, and A's records must not leak into B's lists.
 */
describe('Tenant isolation (e2e)', () => {
    let t: TestApp;
    let A: Clinic, B: Clinic;
    let aDentist: Staff, bDentist: Staff, aRecep: Staff;
    let aPatient: any, bPatient: any;
    let aRoom: any, aAppointment: any, aInvoice: any, aPayment: any, aTreatment: any, aEntry: any, aBlocked: any;

    const DENIED = [403, 404];

    beforeAll(async () => {
        t = await startApp();
        A = await t.registerClinic('Alpha');
        B = await t.registerClinic('Beta');
        aDentist = await t.addStaff(A, 'dentist', 'AlphaDentist');
        aRecep = await t.addStaff(A, 'receptionist', 'AlphaRecep');
        bDentist = await t.addStaff(B, 'dentist', 'BetaDentist');
        aPatient = await t.addPatient(A.token, 'AlphaPatient');
        bPatient = await t.addPatient(B.token, 'BetaPatient');

        aRoom = (await t.api.post('/schedule/rooms', A.token, { name: 'Alpha chair' })).data;
        aTreatment = (
            await t.api.post('/treatments', A.token, { name: 'Alpha filling', category: 'general', price: { amount: 20000, currency: 'AMD' } })
        ).data;
        aAppointment = (
            await t.api.post('/appointments', A.token, {
                patientId: aPatient._id,
                dentistId: aDentist.authId,
                treatmentRoomId: aRoom._id,
                startTime: at(3, 8),
                endTime: at(3, 8, 30),
                allowOutsideHours: true,
            })
        ).data;
        aEntry = (
            await t.api.post(`/dental-records/${aPatient._id}/treatment-entry`, A.token, {
                teeth: [16],
                treatmentName: 'Filling',
                cost: 20000,
                currency: 'AMD',
            })
        ).data;
        aInvoice = (
            await t.api.post('/billing/invoices', A.token, {
                patientId: aPatient._id,
                issue: true,
                items: [{ description: 'Cleaning', unitPrice: 10000 }],
            })
        ).data;
        aPayment = (await t.api.post(`/billing/invoices/${aInvoice._id}/payments`, A.token, { method: 'cash', amount: 4000 })).data
            .payment;
        aBlocked = (
            await t.api.post('/schedule/blocked-times', A.token, {
                dentistId: aDentist.authId,
                startTime: at(4, 8),
                endTime: at(4, 9),
                reason: 'personal',
            })
        ).data.blockedTime;

        for (const [name, v] of Object.entries({ aRoom, aTreatment, aAppointment, aEntry, aInvoice, aPayment, aBlocked })) {
            if (!v?._id) throw new Error(`fixture ${name} was not created`);
        }
    });
    afterAll(() => t.close());

    describe("B cannot read A's records by id", () => {
        const cases: [string, () => string][] = [
            ['patient', () => `/patients/${aPatient._id}`],
            ['patient upcoming appointments', () => `/patients/${aPatient._id}/upcoming-appointments`],
            ['appointment', () => `/appointments/${aAppointment._id}`],
            ['invoice', () => `/billing/invoices/${aInvoice._id}`],
            ['invoice payments', () => `/billing/invoices/${aInvoice._id}/payments`],
            ['patient billing summary', () => `/billing/patients/${aPatient._id}/summary`],
            ['unbilled treatments', () => `/billing/patients/${aPatient._id}/unbilled-treatments`],
            ['dental chart', () => `/dental-records/${aPatient._id}/chart`],
            ['treatment history', () => `/dental-records/${aPatient._id}/treatment-history`],
            ['tooth history', () => `/dental-records/${aPatient._id}/tooth/16/history`],
            ['dental summary', () => `/dental-records/${aPatient._id}/summary`],
            ['staff member', () => `/users/${aDentist.profile._id}`],
            ['staff upcoming appointments', () => `/users/${aDentist.profile._id}/upcoming-appointments`],
            ['treatment', () => `/treatments/${aTreatment._id}`],
            ['dentist availability', () => `/schedule/availability/${aDentist.authId}?date=${at(3, 0).slice(0, 10)}`],
        ];
        it.each(cases)('%s', async (_name, path) => {
            const r = await t.api.get(path(), B.token);
            expect(DENIED).toContain(r.status);
            expect(JSON.stringify(r.body)).not.toContain('AlphaPatient');
        });
    });

    describe("B cannot change A's records by id", () => {
        const cases: [string, () => Promise<{ status: number }>][] = [
            ['update patient', () => t.api.patch(`/patients/${aPatient._id}`, B.token, { firstName: 'Hacked' })],
            ['patient status', () => t.api.patch(`/patients/${aPatient._id}/status`, B.token, { status: 'archived' })],
            ['update appointment', () => t.api.patch(`/appointments/${aAppointment._id}`, B.token, { notes: 'Hacked' })],
            ['appointment status', () => t.api.patch(`/appointments/${aAppointment._id}/status`, B.token, { status: 'confirmed' })],
            ['cancel appointment', () => t.api.patch(`/appointments/${aAppointment._id}/cancel`, B.token, { reason: 'other' })],
            ['update invoice', () => t.api.patch(`/billing/invoices/${aInvoice._id}`, B.token, { notes: 'Hacked' })],
            ['cancel invoice', () => t.api.patch(`/billing/invoices/${aInvoice._id}/cancel`, B.token, { reason: 'Hacked it' })],
            ['pay invoice', () => t.api.post(`/billing/invoices/${aInvoice._id}/payments`, B.token, { method: 'cash', amount: 1000 })],
            [
                'void payment',
                () =>
                    t.api.patch(`/billing/invoices/${aInvoice._id}/payments/${aPayment._id}/void`, B.token, {
                        type: 'refund',
                        reason: 'Hacked it',
                    }),
            ],
            ['chart tooth', () => t.api.patch(`/dental-records/${aPatient._id}/tooth`, B.token, { toothNumber: 11, status: 'missing' })],
            [
                'treatment entry on A patient',
                () => t.api.post(`/dental-records/${aPatient._id}/treatment-entry`, B.token, { teeth: [11], treatmentName: 'x' }),
            ],
            [
                'void A entry',
                () => t.api.patch(`/dental-records/${aPatient._id}/treatment-entry/${aEntry._id}/void`, B.token, { reason: 'Hacked it' }),
            ],
            ['update staff', () => t.api.patch(`/users/${aDentist.profile._id}`, B.token, { firstName: 'Hacked' })],
            ['deactivate staff', () => t.api.patch(`/users/${aDentist.profile._id}/status`, B.token, { isActive: false })],
            ['reset staff password', () => t.api.post(`/users/${aDentist.profile._id}/reset-password`, B.token, { password: 'hacked123' })],
            ['delete staff', () => t.api.del(`/users/${aDentist.profile._id}`, B.token)],
            ['update treatment', () => t.api.patch(`/treatments/${aTreatment._id}`, B.token, { name: 'Hacked' })],
            ['delete treatment', () => t.api.del(`/treatments/${aTreatment._id}`, B.token)],
            ['update room', () => t.api.patch(`/schedule/rooms/${aRoom._id}`, B.token, { name: 'Hacked' })],
            ['delete room', () => t.api.del(`/schedule/rooms/${aRoom._id}`, B.token)],
            ['delete blocked time', () => t.api.del(`/schedule/blocked-times/${aBlocked._id}`, B.token)],
        ];
        it.each(cases)('%s', async (_name, request) => {
            const r = await request();
            // 400 is fine where B's request is refused by validation before the lookup.
            expect([...DENIED, 400]).toContain(r.status);
        });

        it("A's records are unchanged afterwards", async () => {
            const patient = await t.api.get(`/patients/${aPatient._id}`, A.token);
            expect(patient.data.firstName).toBe('AlphaPatient');
            expect(patient.data.status).toBe('active');

            const appt = await t.api.get(`/appointments/${aAppointment._id}`, A.token);
            expect(appt.data.status).toBe('scheduled');
            expect(appt.data.notes ?? '').not.toContain('Hacked');

            const inv = await t.api.get(`/billing/invoices/${aInvoice._id}`, A.token);
            expect(inv.data.status).toBe('partial');
            expect(inv.data.paidAmount).toBe(4000);

            const payments = await t.api.get(`/billing/invoices/${aInvoice._id}/payments`, A.token);
            expect(payments.data.every((p: any) => !p.voidedAt && !p.isVoided && p.status !== 'voided')).toBe(true);

            const dentist = await t.api.get(`/users/${aDentist.profile._id}`, A.token);
            expect(dentist.data.firstName).toBe('AlphaDentist');
            expect(dentist.data.isActive).toBe(true);
            expect((await t.login(aDentist.email, 'staffpass1')).status).toBe(200);

            const treatment = await t.api.get(`/treatments/${aTreatment._id}`, A.token);
            expect(treatment.data.name).toBe('Alpha filling');
            expect(treatment.data.isActive).not.toBe(false);

            const rooms = await t.api.get('/schedule/rooms', A.token);
            expect(rooms.data.some((r: any) => r._id === aRoom._id && r.name === 'Alpha chair')).toBe(true);

            const chart = await t.api.get(`/dental-records/${aPatient._id}/treatment-history`, A.token);
            expect(JSON.stringify(chart.data)).toContain(aEntry._id);
        });
    });

    describe("B cannot put A's ids into its own records", () => {
        const slot = (n: number) => ({ startTime: at(5, 8 + n), endTime: at(5, 8 + n, 30), allowOutsideHours: true });

        it("appointment for A's patient", async () => {
            const r = await t.api.post('/appointments', B.token, { patientId: aPatient._id, dentistId: bDentist.authId, ...slot(0) });
            expect([400, 404]).toContain(r.status);
        });
        it("appointment with A's dentist", async () => {
            const r = await t.api.post('/appointments', B.token, { patientId: bPatient._id, dentistId: aDentist.authId, ...slot(1) });
            expect([400, 404]).toContain(r.status);
        });
        it("appointment in A's room", async () => {
            const r = await t.api.post('/appointments', B.token, {
                patientId: bPatient._id,
                dentistId: bDentist.authId,
                treatmentRoomId: aRoom._id,
                ...slot(2),
            });
            expect([400, 404]).toContain(r.status);
        });
        it("appointment with A's treatment", async () => {
            const r = await t.api.post('/appointments', B.token, {
                patientId: bPatient._id,
                dentistId: bDentist.authId,
                treatmentIds: [aTreatment._id],
                ...slot(3),
            });
            expect([400, 404]).toContain(r.status);
        });
        it("own appointment moved to A's dentist", async () => {
            const own = await t.api.post('/appointments', B.token, { patientId: bPatient._id, dentistId: bDentist.authId, ...slot(4) });
            expect(own.status).toBe(201);
            const r = await t.api.patch(`/appointments/${own.data._id}`, B.token, { dentistId: aDentist.authId, allowOutsideHours: true });
            expect([400, 404]).toContain(r.status);
        });
        it("invoice for A's patient", async () => {
            const r = await t.api.post('/billing/invoices', B.token, {
                patientId: aPatient._id,
                items: [{ description: 'x', unitPrice: 100 }],
            });
            expect([400, 404]).toContain(r.status);
        });
        it("invoice line billing A's treatment entry", async () => {
            const r = await t.api.post('/billing/invoices', B.token, {
                patientId: bPatient._id,
                items: [{ description: 'x', unitPrice: 100, treatmentEntryId: aEntry._id }],
            });
            // The same answer a made-up id gets, so it says nothing about A's entry.
            expect(r.status).toBe(409);
            expect(r.body.code).toBe('treatmentAlreadyBilled');
        });
        it("blocked time for A's dentist", async () => {
            const r = await t.api.post('/schedule/blocked-times', B.token, {
                dentistId: aDentist.authId,
                startTime: at(6, 8),
                endTime: at(6, 9),
                reason: 'personal',
            });
            expect([400, 404]).toContain(r.status);
        });
        it("treatment entry with A's treatment", async () => {
            const r = await t.api.post(`/dental-records/${bPatient._id}/treatment-entry`, B.token, {
                teeth: [11],
                treatmentId: aTreatment._id,
                treatmentName: 'x',
            });
            expect([400, 404]).toContain(r.status);
        });
    });

    describe("A's records never appear in B's lists and reports", () => {
        const lists = [
            '/patients?limit=100',
            '/patients/stats',
            `/patients/duplicates?firstName=AlphaPatient&lastName=${'x'}`,
            '/appointments?limit=100',
            `/appointments/calendar?startDate=${at(-1, 0).slice(0, 10)}&endDate=${at(10, 0).slice(0, 10)}`,
            '/appointments/today',
            '/billing/invoices?limit=100',
            '/users?limit=100',
            '/users/dentists',
            '/treatments?limit=100',
            '/schedule/rooms',
            '/schedule/blocked-times',
            '/notifications',
            '/settings/templates',
            '/reports/dashboard',
            '/reports/revenue',
            '/reports/appointments',
            '/reports/dentist-performance',
            '/reports/treatments',
            '/reports/patients',
            '/clinics/current',
        ];
        it.each(lists)('%s', async (path) => {
            const r = await t.api.get(path, B.token);
            expect(r.status).toBe(200);
            const text = JSON.stringify(r.body);
            for (const id of [aPatient._id, aAppointment._id, aInvoice._id, aDentist.profile._id, aTreatment._id, aRoom._id, A.clinicId]) {
                expect(text).not.toContain(id);
            }
            expect(text).not.toMatch(/Alpha(Patient|Dentist|Recep)|Alpha (chair|filling)/);
        });

        it("B's revenue does not include A's payment", async () => {
            const r = await t.api.get('/reports/revenue', B.token);
            expect(r.data.collected ?? r.data.total ?? 0).toBe(0);
        });
    });

    it("A's receptionist sees A's data (the checks above are not just denying everyone)", async () => {
        expect((await t.api.get(`/patients/${aPatient._id}`, aRecep.token)).status).toBe(200);
        expect((await t.api.get(`/appointments/${aAppointment._id}`, aRecep.token)).status).toBe(200);
        expect((await t.api.get(`/billing/invoices/${aInvoice._id}`, aRecep.token)).status).toBe(200);
    });
});
