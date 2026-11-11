import { at, Clinic, Staff, startApp, TestApp } from './app';

describe('Appointment conflicts and status transitions (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let recep: Staff, d1: Staff, d2: Staff, assistant: Staff;
    let room1: any, room2: any;
    let day = 10;

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Appt');
        recep = await t.addStaff(C, 'receptionist');
        d1 = await t.addStaff(C, 'dentist', 'DentistOne');
        d2 = await t.addStaff(C, 'dentist', 'DentistTwo');
        assistant = await t.addStaff(C, 'assistant');
        room1 = (await t.api.post('/schedule/rooms', C.token, { name: 'Chair 1' })).data;
        room2 = (await t.api.post('/schedule/rooms', C.token, { name: 'Chair 2' })).data;
    });
    afterAll(() => t.close());

    /** A fresh future day per test, so tests never see each other's bookings. */
    const nextDay = () => ++day;
    const book = (o: { dentist?: Staff; patient: any; d: number; h: number; m?: number; len?: number; room?: any; token?: string }) => {
        const start = at(o.d, o.h, o.m ?? 0);
        const end = new Date(new Date(start).getTime() + (o.len ?? 30) * 60_000).toISOString();
        return t.api.post('/appointments', o.token ?? recep.token, {
            patientId: o.patient._id,
            dentistId: (o.dentist ?? d1).authId,
            startTime: start,
            endTime: end,
            allowOutsideHours: true,
            ...(o.room ? { treatmentRoomId: o.room._id } : {}),
        });
    };
    const move = (id: string, d: number, h: number, m = 0, extra: Record<string, unknown> = {}, token = recep.token) =>
        t.api.patch(`/appointments/${id}`, token, {
            startTime: at(d, h, m),
            endTime: at(d, h, m + 30),
            allowOutsideHours: true,
            ...extra,
        });
    const setStatus = (id: string, status: string, token = recep.token) =>
        t.api.patch(`/appointments/${id}/status`, token, { status });
    const cancel = (id: string, token = recep.token) =>
        t.api.patch(`/appointments/${id}/cancel`, token, { reason: 'patient_request' });
    const live = async (d: number) => {
        const r = await t.api.get(`/appointments/calendar?startDate=${at(d, 0)}&endDate=${at(d + 1, 0)}`, C.token);
        expect(r.status).toBe(200);
        return (r.data as any[]).filter((a) => ['scheduled', 'confirmed', 'in_progress'].includes(a.status));
    };

    describe('conflict detection', () => {
        let p1: any, p2: any, p3: any;
        beforeAll(async () => {
            p1 = await t.addPatient(C.token, 'One');
            p2 = await t.addPatient(C.token, 'Two');
            p3 = await t.addPatient(C.token, 'Three');
        });

        it('same dentist, overlapping time -> 409; back-to-back is fine', async () => {
            const d = nextDay();
            expect((await book({ patient: p1, d, h: 8 })).status).toBe(201);
            const clash = await book({ patient: p2, d, h: 8, m: 15 });
            expect(clash.status).toBe(409);
            expect(clash.body.code).toBe('appointmentConflictDentist');
            expect((await book({ patient: p2, d, h: 8, m: 30 })).status).toBe(201);
            expect((await book({ patient: p3, d, h: 7, m: 30 })).status).toBe(201);
        });

        it('same room -> 409 appointmentConflictRoom; another room is fine', async () => {
            const d = nextDay();
            expect((await book({ patient: p1, d, h: 8, room: room1 })).status).toBe(201);
            const clash = await book({ patient: p2, dentist: d2, d, h: 8, room: room1 });
            expect(clash.status).toBe(409);
            expect(clash.body.code).toBe('appointmentConflictRoom');
            expect((await book({ patient: p2, dentist: d2, d, h: 8, room: room2 })).status).toBe(201);
        });

        it('same patient with two dentists at once -> 409 appointmentConflictPatient', async () => {
            const d = nextDay();
            expect((await book({ patient: p1, d, h: 9 })).status).toBe(201);
            const clash = await book({ patient: p1, dentist: d2, d, h: 9, m: 10 });
            expect(clash.status).toBe(409);
            expect(clash.body.code).toBe('appointmentConflictPatient');
        });

        it('a cancelled appointment frees its slot', async () => {
            const d = nextDay();
            const a = await book({ patient: p1, d, h: 10 });
            expect((await cancel(a.data._id)).status).toBe(200);
            expect((await book({ patient: p2, d, h: 10 })).status).toBe(201);
        });

        it('blocked time is always respected; working hours unless overridden', async () => {
            const d = nextDay();
            const block = await t.api.post('/schedule/blocked-times', C.token, {
                dentistId: d1.authId,
                startTime: at(d, 9),
                endTime: at(d, 10),
                reason: 'personal',
            });
            expect(block.status).toBe(201);
            const inBlock = await book({ patient: p1, d, h: 9, m: 15 });
            expect(inBlock.status).toBe(409);
            expect(inBlock.body.code).toBe('appointmentInBlockedTime');

            // A new clinic has no opening hours, which means no limit; give it some.
            const hours = await t.api.patch('/clinics/current/working-hours', C.token, {
                workingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '18:00', isOpen: true })),
            });
            expect(hours.status).toBe(200);
            const night = { patientId: p1._id, dentistId: d1.authId, startTime: at(d, 23), endTime: at(d, 23, 30) };
            const refused = await t.api.post('/appointments', recep.token, night);
            expect(refused.status).toBe(409);
            expect(refused.body.code).toBe('appointmentOutsideHours');
            expect((await t.api.post('/appointments', recep.token, { ...night, allowOutsideHours: true })).status).toBe(201);
        });

        it('rejects end before start and visits over 12 hours', async () => {
            const d = nextDay();
            const back = await t.api.post('/appointments', recep.token, {
                patientId: p1._id,
                dentistId: d1.authId,
                startTime: at(d, 10),
                endTime: at(d, 9),
                allowOutsideHours: true,
            });
            expect(back.body.code).toBe('appointmentEndBeforeStart');
            const long = await t.api.post('/appointments', recep.token, {
                patientId: p1._id,
                dentistId: d1.authId,
                startTime: at(d, 0),
                endTime: at(d, 13),
                allowOutsideHours: true,
            });
            expect(long.body.code).toBe('appointmentTooLong');
        });

        it('six receptionists booking one slot at once: exactly one booking survives', async () => {
            const d = nextDay();
            const patients = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => t.addPatient(C.token, `Race${i}`)));
            const results = await Promise.all(patients.map((patient) => book({ patient, d, h: 11 })));
            expect(results.filter((r) => r.status === 201)).toHaveLength(1);
            for (const r of results.filter((x) => x.status !== 201)) expect(r.status).toBe(409);
            expect(await live(d)).toHaveLength(1);
        });

        it('moving into a taken slot -> 409; moving within its own slot is fine', async () => {
            const d = nextDay();
            await book({ patient: p1, d, h: 8 });
            const b = (await book({ patient: p2, d, h: 10 })).data;
            const clash = await move(b._id, d, 8, 15);
            expect(clash.status).toBe(409);
            expect(clash.body.code).toBe('appointmentConflictDentist');
            expect((await move(b._id, d, 10, 15)).status).toBe(200);
        });

        it('two appointments moved into the same free slot at once: never both kept', async () => {
            const d = nextDay();
            const a = (await book({ patient: p1, d, h: 8 })).data;
            const b = (await book({ patient: p2, d, h: 9 })).data;
            const results = await Promise.all([move(a._id, d, 12), move(b._id, d, 12, 10)]);
            expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
            const atNoon = (await live(d)).filter((x) => new Date(x.startTime).getUTCHours() === 12);
            expect(atNoon.length).toBeLessThanOrEqual(1);
            // Whatever was refused is back where it was.
            const all = await live(d);
            expect(all).toHaveLength(2);
            for (const r of results.filter((x) => x.status !== 200)) expect(r.status).toBe(409);
        });

        it('a move and a new booking for the same slot at once: never both kept', async () => {
            for (let round = 0; round < 3; round++) {
                const d = nextDay();
                const a = (await book({ patient: p1, d, h: 8 })).data;
                const [moved, booked] = await Promise.all([move(a._id, d, 13), book({ patient: p2, d, h: 13, m: 15 })]);
                expect([moved.status, booked.status].filter((s) => s < 300).length).toBeLessThanOrEqual(1);
                const overlapping = (await live(d)).filter((x) => new Date(x.startTime).getUTCHours() === 13);
                expect(overlapping.length).toBeLessThanOrEqual(1);
            }
        });

        it('two reschedules at once: it ends at one of the requested times, not a mix', async () => {
            const d = nextDay();
            const a = (await book({ patient: p1, d, h: 8 })).data;
            const [first, second] = await Promise.all([move(a._id, d, 14), move(a._id, d, 15)]);
            const ok = [first, second].filter((r) => r.status === 200);
            expect(ok.length).toBeGreaterThanOrEqual(1);
            const final = (await t.api.get(`/appointments/${a._id}`, C.token)).data;
            // Whichever won, the appointment is at the winner's time, not shuffled back.
            expect(ok.map((r) => r.data.startTime)).toContain(final.startTime);
        });

        it('a series skips the clashing dates and reports them', async () => {
            const d = nextDay();
            await book({ patient: p2, d: d + 7, h: 8 });
            const r = await t.api.post('/appointments/recurring', recep.token, {
                patientId: p1._id,
                dentistId: d1.authId,
                startTime: at(d, 8),
                endTime: at(d, 8, 30),
                allowOutsideHours: true,
                recurringPattern: { frequency: 'weekly', interval: 1, endDate: at(d + 21, 0).slice(0, 10) },
            });
            expect(r.status).toBe(201);
            expect(r.data.created).toHaveLength(3);
            expect(r.data.skipped).toHaveLength(1);
            day += 30;
        });
    });

    describe('status transitions', () => {
        let p: any;
        beforeAll(async () => {
            p = await t.addPatient(C.token, 'Status');
        });

        /** An appointment that has already started, so outcomes can be recorded. */
        const past = async () => {
            const r = await book({ patient: p, d: -1, h: 8 + Math.floor(Math.random() * 10), m: Math.floor(Math.random() * 2) * 30 });
            if (r.status !== 201) return past();
            return r.data;
        };

        it('scheduled -> confirmed -> in_progress -> completed; completed is final', async () => {
            const a = await past();
            for (const status of ['confirmed', 'in_progress', 'completed']) {
                const r = await setStatus(a._id, status);
                expect(r.status).toBe(200);
                expect(r.data.status).toBe(status);
            }
            for (const status of ['scheduled', 'confirmed', 'in_progress', 'no_show']) {
                const r = await setStatus(a._id, status);
                expect(r.status).toBe(400);
                expect(r.body.code).toBe('invalidStatusTransition');
            }
            expect((await cancel(a._id)).status).toBe(400);
            expect((await move(a._id, -1, 6)).body.code).toBe('appointmentNotEditable');
        });

        it('in_progress can only complete', async () => {
            const a = await past();
            expect((await setStatus(a._id, 'in_progress')).status).toBe(200);
            for (const status of ['scheduled', 'confirmed', 'no_show']) {
                expect((await setStatus(a._id, status)).body.code).toBe('invalidStatusTransition');
            }
        });

        it('no-show and outcomes cannot be recorded before the visit starts', async () => {
            const d = nextDay();
            const a = (await book({ patient: p, d, h: 8 })).data;
            for (const status of ['in_progress', 'completed', 'no_show']) {
                const r = await setStatus(a._id, status);
                expect(r.status).toBe(400);
                expect(r.body.code).toBe('appointmentNotStarted');
            }
        });

        it('cancelled goes through /cancel with a reason, and can be restored if the slot is free', async () => {
            const d = nextDay();
            const a = (await book({ patient: p, d, h: 9 })).data;
            const viaStatus = await setStatus(a._id, 'cancelled');
            expect(viaStatus.body.code).toBe('useCancelEndpoint');
            const noReason = await t.api.patch(`/appointments/${a._id}/cancel`, recep.token, {});
            expect(noReason.status).toBe(400);

            expect((await cancel(a._id)).data.status).toBe('cancelled');
            const restored = await setStatus(a._id, 'scheduled');
            expect(restored.status).toBe(200);
            expect(restored.data.cancelReason).toBeUndefined();
        });

        it('restoring is refused when the slot was given away, and the cancellation stays', async () => {
            const d = nextDay();
            const other = await t.addPatient(C.token, 'Taker');
            const a = (await book({ patient: p, d, h: 9 })).data;
            await cancel(a._id);
            expect((await book({ patient: other, d, h: 9 })).status).toBe(201);
            const r = await setStatus(a._id, 'scheduled');
            expect(r.status).toBe(409);
            const still = (await t.api.get(`/appointments/${a._id}`, C.token)).data;
            expect(still.status).toBe('cancelled');
            expect(still.cancelReason).toBe('patient_request');
        });

        it('restoring and booking the same slot at once: never both kept', async () => {
            for (let round = 0; round < 3; round++) {
                const d = nextDay();
                const other = await t.addPatient(C.token, `Racer${round}`);
                const a = (await book({ patient: p, d, h: 9 })).data;
                await cancel(a._id);
                const [restored, booked] = await Promise.all([setStatus(a._id, 'scheduled'), book({ patient: other, d, h: 9 })]);
                expect([restored.status, booked.status].filter((s) => s < 300).length).toBeLessThanOrEqual(1);
                expect(await live(d)).toHaveLength(restored.status === 200 || booked.status === 201 ? 1 : 0);
                const after = (await t.api.get(`/appointments/${a._id}`, C.token)).data;
                if (restored.status !== 200) expect(after.status).toBe('cancelled');
            }
        });

        it('two people pressing different buttons at once: one wins, no mixed state', async () => {
            const a = await past();
            const results = await Promise.all([setStatus(a._id, 'completed'), setStatus(a._id, 'no_show', d1.token)]);
            expect(results.filter((r) => r.status === 200)).toHaveLength(1);
            const loser = results.find((r) => r.status !== 200)!;
            expect([400, 409]).toContain(loser.status);
            const final = (await t.api.get(`/appointments/${a._id}`, C.token)).data;
            expect(['completed', 'no_show']).toContain(final.status);
        });

        it('an edit racing a cancellation never moves a cancelled appointment', async () => {
            const d = nextDay();
            const a = (await book({ patient: p, d, h: 10 })).data;
            const [moved, cancelled] = await Promise.all([move(a._id, d, 16), cancel(a._id)]);
            const final = (await t.api.get(`/appointments/${a._id}`, C.token)).data;
            if (cancelled.status === 200 && moved.status !== 200) {
                expect(new Date(final.startTime).getUTCHours()).toBe(10);
            }
            expect(['cancelled', 'scheduled']).toContain(final.status);
        });

        it('the assistant can look but not change status', async () => {
            const a = await past();
            expect((await t.api.get(`/appointments/${a._id}`, assistant.token)).status).toBe(200);
            expect((await setStatus(a._id, 'confirmed', assistant.token)).status).toBe(403);
        });
    });
});
