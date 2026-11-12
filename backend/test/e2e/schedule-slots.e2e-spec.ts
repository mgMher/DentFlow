import { at, Clinic, Staff, startApp, TestApp } from './app';

/**
 * F2: free start times for a visit, and the calendar filtered by chair.
 * The clinic is in Yerevan (UTC+4): 09:00 local is 05:00Z.
 */
describe('Schedule slots (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let d1: Staff, d2: Staff;
    let p1: any, p2: any, room: any;
    let day: string;

    /** `HH:MM` local (Yerevan) on `day` as an ISO instant. */
    const local = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h - 4, m)).toISOString();
    };
    const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
    const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    const slots = async (q: Record<string, string | number>, token = C.token) => {
        const r = await t.api.get(`/schedule/slots?${new URLSearchParams(q as Record<string, string>)}`, token);
        return r;
    };
    const book = (patient: any, dentist: Staff, from: string, minutes: number, extra: Record<string, unknown> = {}) =>
        t.api.post('/appointments', C.token, {
            patientId: patient._id,
            dentistId: dentist.authId,
            startTime: local(from),
            endTime: plus(local(from), minutes),
            ...extra,
        });

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Slots');
        d1 = await t.addStaff(C, 'dentist', 'SlotOne');
        d2 = await t.addStaff(C, 'dentist', 'SlotTwo');
        p1 = await t.addPatient(C.token, 'SlotP1');
        p2 = await t.addPatient(C.token, 'SlotP2');
        room = (await t.api.post('/schedule/rooms', C.token, { name: 'Chair S' })).data;
        day = at(4, 8).slice(0, 10);
        // Open 09:00–18:00 on `day`'s weekday only, so the next day is a day off.
        const hours = await t.api.patch('/clinics/current/working-hours', C.token, {
            workingHours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
                dayOfWeek: d,
                startTime: '09:00',
                endTime: '18:00',
                isOpen: d === weekday(day),
            })),
        });
        expect(hours.status).toBe(200);
    });
    afterAll(() => t.close());

    it('an empty working day: every 15-minute start where 30 minutes fit', async () => {
        const r = await slots({ dentistId: d1.authId, date: day, duration: 30 });
        expect(r.status).toBe(200);
        expect(r.data.off).toBe(false);
        expect(r.data.hoursConfigured).toBe(true);
        expect(r.data.window).toEqual({ start: local('09:00'), end: local('18:00') });
        expect(r.data.slots).toHaveLength(35);
        expect(r.data.slots[0]).toBe(local('09:00'));
        expect(r.data.slots[34]).toBe(local('17:30'));
    });

    it("the dentist's bookings and blocked time are taken out", async () => {
        expect((await book(p1, d1, '10:00', 30)).status).toBe(201);
        const block = await t.api.post('/schedule/blocked-times', C.token, {
            dentistId: d1.authId,
            startTime: local('12:00'),
            endTime: local('13:00'),
            reason: 'lunch',
        });
        expect(block.status).toBe(201);
        const r = await slots({ dentistId: d1.authId, date: day, duration: 30 });
        for (const taken of ['09:45', '10:00', '10:15', '11:45', '12:00', '12:30', '12:45']) {
            expect(r.data.slots).not.toContain(local(taken));
        }
        expect(r.data.slots).toContain(local('09:30'));
        expect(r.data.slots).toContain(local('10:30'));
        expect(r.data.slots).toContain(local('13:00'));
        expect(r.data.slots).toHaveLength(35 - 3 - 5);
    });

    it('a chair booked by another dentist, and the patient booked elsewhere, count when given', async () => {
        expect((await book(p2, d2, '15:00', 60, { treatmentRoomId: room._id })).status).toBe(201);
        const withoutRoom = await slots({ dentistId: d1.authId, date: day, duration: 30 });
        const withRoom = await slots({ dentistId: d1.authId, date: day, duration: 30, treatmentRoomId: room._id });
        expect(withoutRoom.data.slots).toContain(local('15:00'));
        expect(withRoom.data.slots).not.toContain(local('15:00'));
        expect(withRoom.data.slots).toHaveLength(withoutRoom.data.slots.length - 5);

        // p1 is with d1 at 10:00: d2 cannot see p1 then.
        const forPatient = await slots({ dentistId: d2.authId, date: day, duration: 30, patientId: p1._id });
        expect(forPatient.data.slots).not.toContain(local('10:00'));
        const d2Free = await slots({ dentistId: d2.authId, date: day, duration: 30 });
        expect(d2Free.data.slots).toContain(local('10:00'));
    });

    it("moving an appointment: its own time is offered", async () => {
        const own = (await t.api.get(`/appointments/calendar?startDate=${local('00:00')}&endDate=${local('23:59')}&dentistId=${d1.authId}`, C.token)).data[0];
        const r = await slots({ dentistId: d1.authId, date: day, duration: 30, excludeAppointmentId: own._id });
        expect(r.data.slots).toContain(local('10:00'));
    });

    it('longer visits need a longer gap; the last start leaves room before closing', async () => {
        const r = await slots({ dentistId: d1.authId, date: day, duration: 120, step: 30 });
        expect(r.data.slots).not.toContain(local('11:00')); // would run into the 12:00 block
        expect(r.data.slots).toContain(local('13:00'));
        expect(r.data.slots[r.data.slots.length - 1]).toBe(local('16:00'));
    });

    it('a day off has no slots; a clinic without hours gets 08:00–20:00', async () => {
        const next = await slots({ dentistId: d1.authId, date: at(5, 8).slice(0, 10), duration: 30 });
        expect(next.data).toMatchObject({ off: true, slots: [] });

        const open = await t.registerClinic('NoHours');
        const dentist = await t.addStaff(open, 'dentist');
        const r = await slots({ dentistId: dentist.authId, date: day, duration: 60 }, open.token);
        expect(r.data.hoursConfigured).toBe(false);
        expect(r.data.window).toEqual({ start: local('08:00'), end: local('20:00') });
        expect(r.data.slots).toHaveLength(45);
    });

    it('times already past are not offered', async () => {
        const today = at(0, 8).slice(0, 10);
        const r = await slots({ dentistId: d1.authId, date: today, duration: 15 });
        expect(r.data.slots.every((s: string) => new Date(s).getTime() >= Date.now() - 60_000)).toBe(true);
    });

    it('rejects bad input and other clinics', async () => {
        expect((await slots({ dentistId: d1.authId, date: day, duration: 3 })).status).toBe(400);
        expect((await slots({ dentistId: d1.authId, date: day, duration: 30, step: 7 })).status).toBe(400);
        expect((await slots({ dentistId: d1.authId, date: '20-11-2026', duration: 30 })).status).toBe(400);
        const other = await t.registerClinic('OtherSlots');
        expect((await slots({ dentistId: d1.authId, date: day, duration: 30 }, other.token)).status).toBe(404);
    });

    it('an appointment moves to another chair, or out of its chair', async () => {
        const second = (await t.api.post('/schedule/rooms', C.token, { name: 'Chair T' })).data;
        const a = (await book(p1, d1, '16:30', 30, { treatmentRoomId: room._id })).data;
        const moved = await t.api.patch(`/appointments/${a._id}`, C.token, { treatmentRoomId: second._id });
        expect(moved.status).toBe(200);
        expect(moved.data.treatmentRoomId.name).toBe('Chair T');
        const cleared = await t.api.patch(`/appointments/${a._id}`, C.token, { treatmentRoomId: null });
        expect(cleared.status).toBe(200);
        expect(cleared.data.treatmentRoomId ?? null).toBeNull();
        expect((await t.api.patch(`/appointments/${a._id}`, C.token, { treatmentRoomId: '' })).status).toBe(400);
        // Clearing is not a way into a taken chair: moving into Chair S at 15:00 still clashes.
        const clash = await t.api.patch(`/appointments/${a._id}`, C.token, {
            startTime: local('15:00'),
            endTime: local('15:30'),
            treatmentRoomId: room._id,
        });
        expect(clash.status).toBe(409);
        expect(clash.body.code).toBe('appointmentConflictRoom');
    });

    it('the calendar can show one chair', async () => {
        const r = await t.api.get(
            `/appointments/calendar?startDate=${local('00:00')}&endDate=${local('23:59')}&treatmentRoomId=${room._id}`,
            C.token,
        );
        expect(r.status).toBe(200);
        expect(r.data.length).toBeGreaterThan(0);
        expect(r.data.every((a: any) => a.treatmentRoomId?.name === 'Chair S')).toBe(true);
    });
});
