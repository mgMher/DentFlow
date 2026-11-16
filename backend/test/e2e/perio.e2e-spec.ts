import { Clinic, Staff, startApp, TestApp } from './app';

/** F12: periodontal exams — six sites a tooth, by date, compared with the one before. */
describe('Periodontal exams (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let dentist: Staff, assistant: Staff, recep: Staff;
    let patient: any;
    let first: any;

    const site = (pd: number | null, rec: number | null = 0, bop = false, plaque = false) => ({ pd, rec, bop, sup: false, plaque });
    const six = (pd: number, opts: { bop?: boolean; rec?: number } = {}) => Array.from({ length: 6 }, () => site(pd, opts.rec ?? 0, !!opts.bop));
    const yesterday = new Date(Date.now() + 4 * 3600_000 - 86400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 4 * 3600_000 + 86400_000).toISOString().slice(0, 10);

    const create = (body: Record<string, unknown> = {}, token = dentist.token, patientId = patient._id) =>
        t.api.post(`/patients/${patientId}/perio-exams`, token, body);
    const saveTooth = (examId: string, n: number, body: Record<string, unknown>, token = assistant.token) =>
        t.api.put(`/perio-exams/${examId}/teeth/${n}`, token, body);

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Perio');
        dentist = await t.addStaff(C, 'dentist', 'PerioDentist');
        assistant = await t.addStaff(C, 'assistant');
        recep = await t.addStaff(C, 'receptionist');
        patient = await t.addPatient(C.token, 'Probed');
        // The chart says 18 is missing and 36 is an implant.
        await t.api.patch(`/dental-records/${patient._id}/teeth`, dentist.token, {
            teeth: [
                { toothNumber: 18, status: 'missing' },
                { toothNumber: 36, status: 'implant' },
            ],
        });
    });
    afterAll(() => t.close());

    it('a new exam: the chart’s teeth, with missing teeth and implants marked; the dentist is whoever records it', async () => {
        const r = await create({ date: yesterday });
        expect(r.status).toBe(201);
        first = r.data;
        expect(first.date).toBe(yesterday);
        expect(first.dentistId).toMatchObject({ _id: dentist.authId, firstName: 'PerioDentist' });
        expect(first.teeth).toHaveLength(32);
        expect(first.teeth.find((x: any) => x.toothNumber === 18)).toMatchObject({ missing: true, implant: false });
        expect(first.teeth.find((x: any) => x.toothNumber === 36)).toMatchObject({ missing: false, implant: true });
        expect(first.teeth[0].sites).toHaveLength(6);
        expect(first.teeth[0].sites[0]).toEqual({ pd: null, rec: null, bop: false, sup: false, plaque: false });
        expect(first.previous).toBeNull();
        expect(first.summary).toMatchObject({ teeth: 31, sitesProbed: 0, meanPd: null });
    });

    it('an assistant fills it in tooth by tooth; the figures follow', async () => {
        const r = await saveTooth(first._id, 16, {
            mobility: 1,
            furcation: 2,
            sites: [site(5, 1, true), site(3), site(4, 0, true, true), site(3), site(2), site(6, 2, true)],
        });
        expect(r.status).toBe(200);
        expect(r.data.tooth).toMatchObject({ toothNumber: 16, mobility: 1, furcation: 2 });
        expect(r.data.tooth.sites[5]).toEqual({ pd: 6, rec: 2, bop: true, sup: false, plaque: false });
        expect(r.data.summary).toMatchObject({ sitesProbed: 6, sites4plus: 3, sites6plus: 1, mobileTeeth: 1, furcationTeeth: 1 });

        // Saving the same tooth again replaces it whole.
        await saveTooth(first._id, 11, { sites: six(2) });
        const again = await saveTooth(first._id, 11, { sites: six(3, { bop: true }) });
        expect(again.data.tooth.sites.map((s: any) => s.pd)).toEqual([3, 3, 3, 3, 3, 3]);
        expect(again.data.summary.sitesProbed).toBe(12);
    });

    it('refuses impossible values and teeth not in the exam', async () => {
        expect((await saveTooth(first._id, 16, { sites: [site(16)] })).status).toBe(400); // five sites short, and too deep
        expect((await saveTooth(first._id, 16, { sites: [site(16), site(1), site(1), site(1), site(1), site(1)] })).status).toBe(400);
        expect((await saveTooth(first._id, 16, { sites: [site(1, -6), site(1), site(1), site(1), site(1), site(1)] })).status).toBe(400);
        expect((await saveTooth(first._id, 16, { mobility: 4 })).status).toBe(400);
        expect((await saveTooth(first._id, 55, { sites: six(2) })).body.code).toBe('toothNotInExam');
        expect((await create({ date: tomorrow })).body.code).toBe('perioExamInFuture');
    });

    it('the next exam shows the one before it, to compare', async () => {
        const second = (await create({}, assistant.token)).data;
        // An assistant leaves the dentist empty unless they name one.
        expect(second.dentistId).toBeFalsy();
        expect(second.previous).toMatchObject({ _id: first._id, date: yesterday });
        expect(second.previous.summary.sitesProbed).toBe(12);
        expect(second.previous.teeth.find((x: any) => x.toothNumber === 16).sites[0].pd).toBe(5);
        await saveTooth(second._id, 16, { sites: six(3) });

        const named = await t.api.patch(`/perio-exams/${second._id}`, assistant.token, { dentistId: dentist.authId, notes: 'Re-evaluation after scaling' });
        expect(named.data.dentistId).toMatchObject({ _id: dentist.authId });
        expect(named.data.notes).toBe('Re-evaluation after scaling');
        expect((await t.api.patch(`/perio-exams/${second._id}`, assistant.token, { dentistId: assistant.authId })).body.code).toBe('dentistNotFound');

        const list = (await t.api.get(`/patients/${patient._id}/perio-exams`, recep.token)).data;
        expect(list.map((e: any) => e._id)).toEqual([second._id, first._id]);
        expect(list[0]).not.toHaveProperty('teeth');
        expect(list[0].summary.meanPd).toBe(3);
        expect(list[1].summary.sitesProbed).toBe(12);
    });

    it('a mixed chart gives a mixed exam', async () => {
        const child = await t.addPatient(C.token, 'Child');
        await t.api.get(`/dental-records/${child._id}/chart?chartType=mixed`, dentist.token);
        const exam = (await create({}, dentist.token, child._id)).data;
        expect(exam.teeth.map((x: any) => x.toothNumber)).toContain(55);
        expect(exam.teeth.map((x: any) => x.toothNumber)).toContain(16);
        expect(exam.teeth).toHaveLength(24);
    });

    it('who may do what', async () => {
        expect((await create({}, recep.token)).status).toBe(403);
        expect((await saveTooth(first._id, 11, { sites: six(2) }, recep.token)).status).toBe(403);
        expect((await t.api.get(`/perio-exams/${first._id}`, recep.token)).status).toBe(200);
        expect((await t.api.del(`/perio-exams/${first._id}`, assistant.token)).status).toBe(403);
    });

    it('removing hides it from the record and needs a reason', async () => {
        const third = (await create({})).data;
        expect((await t.call('DELETE', `/perio-exams/${third._id}`, { token: dentist.token, body: {} })).status).toBe(400);
        const del = await t.call('DELETE', `/perio-exams/${third._id}`, { token: dentist.token, body: { reason: 'Started by mistake' } });
        expect(del.data).toEqual({ removed: true });
        expect((await t.api.get(`/perio-exams/${third._id}`, dentist.token)).body.code).toBe('perioExamNotFound');
        expect((await saveTooth(third._id, 11, { sites: six(2) })).body.code).toBe('perioExamNotFound');
        const list = (await t.api.get(`/patients/${patient._id}/perio-exams`, dentist.token)).data;
        expect(list.map((e: any) => e._id)).not.toContain(third._id);
    });

    it('changes are in the audit log, tooth by tooth, on the patient’s history', async () => {
        const items = (await t.api.get(`/patients/${patient._id}/history?limit=100`, C.token)).data.items;
        const saved = items.find((e: any) => e.event === 'perio.saveTooth' && e.changes?.some((c: any) => c.field === '16.pd'));
        expect(saved).toBeTruthy();
        expect(saved.changes.find((c: any) => c.field === '16.pd')).toMatchObject({ to: expect.stringContaining('/') });
        const events = items.map((e: any) => e.event);
        expect(events).toEqual(expect.arrayContaining(['perio.create', 'perio.update', 'perio.remove']));
    });

    it('other clinics see nothing', async () => {
        const other = await t.registerClinic('OtherPerio');
        expect((await t.api.get(`/perio-exams/${first._id}`, other.token)).status).toBe(404);
        expect((await t.api.get(`/patients/${patient._id}/perio-exams`, other.token)).status).toBe(404);
        expect((await t.api.put(`/perio-exams/${first._id}/teeth/11`, other.token, { sites: six(9) })).status).toBe(404);
    });
});
