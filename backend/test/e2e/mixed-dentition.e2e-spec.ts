import { Clinic, Staff, startApp, TestApp } from './app';

/** F12: a mixed-dentition chart — one row per position, the primary tooth or its permanent successor. */
describe('Mixed dentition (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let dentist: Staff, assistant: Staff;

    const numbers = (chart: any) => chart.teeth.map((x: any) => x.toothNumber);
    const toothOf = (chart: any, n: number) => chart.teeth.find((x: any) => x.toothNumber === n);
    const chart = async (patientId: string, query = '') => (await t.api.get(`/dental-records/${patientId}/chart${query}`, dentist.token)).data;
    const setType = (patientId: string, chartType: string) =>
        t.api.patch(`/dental-records/${patientId}/chart-type`, dentist.token, { chartType });
    const erupt = (patientId: string, toothNumber: number, token = dentist.token) =>
        t.api.patch(`/dental-records/${patientId}/erupt`, token, { toothNumber });
    const unerupt = (patientId: string, toothNumber: number) =>
        t.api.patch(`/dental-records/${patientId}/unerupt`, dentist.token, { toothNumber });
    const fill = (patientId: string, toothNumber: number, notes = '') =>
        t.api.patch(`/dental-records/${patientId}/tooth`, dentist.token, {
            toothNumber,
            surfaces: [{ surface: 'occlusal', status: 'filled' }],
            notes,
        });

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Mixed');
        dentist = await t.addStaff(C, 'dentist', 'MixDentist');
        assistant = await t.addStaff(C, 'assistant');
    });
    afterAll(() => t.close());

    it('a new mixed chart: the 20 primary teeth and the four first permanent molars, in chart order', async () => {
        const p = await t.addPatient(C.token, 'NewMixed');
        const c = await chart(p._id, '?chartType=mixed');
        expect(c.chartType).toBe('mixed');
        expect(numbers(c)).toHaveLength(24);
        expect(numbers(c).slice(0, 6)).toEqual([51, 52, 53, 54, 55, 16]);
        expect(numbers(c).slice(-6)).toEqual([81, 82, 83, 84, 85, 46]);
        expect(c.replacedTeeth).toEqual([]);
    });

    it('switching from an untouched permanent chart gives the default mixed chart, keeping what was charted', async () => {
        const p = await t.addPatient(C.token, 'Switcher');
        await chart(p._id); // the default: permanent
        expect((await fill(p._id, 11, 'chipped')).status).toBe(200);
        const r = await setType(p._id, 'mixed');
        expect(r.status).toBe(200);
        // 11 had something recorded, so it stays; the other untouched permanent incisors become primary.
        expect(numbers(r.data).slice(0, 6)).toEqual([11, 52, 53, 54, 55, 16]);
        expect(toothOf(r.data, 11).notes).toBe('chipped');
        expect(r.data.archivedChartTypes).toEqual(['adult']);

        // Charting a primary tooth, then back to permanent: 11 is the same record, nothing lost.
        await fill(p._id, 54);
        const adult = (await setType(p._id, 'adult')).data;
        expect(numbers(adult)).toHaveLength(32);
        expect(toothOf(adult, 11).notes).toBe('chipped');
        // And to mixed again: the mixed chart comes back as it was, 54 included.
        const again = (await setType(p._id, 'mixed')).data;
        expect(toothOf(again, 54).surfaces).toEqual([expect.objectContaining({ surface: 'occlusal', status: 'filled' })]);
        expect(numbers(again)).toHaveLength(24);
    });

    it('from a primary chart: what was charted on primary teeth is kept', async () => {
        const p = await t.addPatient(C.token, 'FromPrimary');
        await chart(p._id, '?chartType=pediatric');
        await fill(p._id, 85, 'sealed');
        const mixed = (await setType(p._id, 'mixed')).data;
        expect(toothOf(mixed, 85).notes).toBe('sealed');
        expect(numbers(mixed)).toContain(46);
    });

    it('a permanent tooth erupts: its primary predecessor leaves the chart with its history, and comes back on undo', async () => {
        const p = await t.addPatient(C.token, 'Erupting');
        await chart(p._id, '?chartType=mixed');
        await fill(p._id, 51, 'caries treated');

        const r = await erupt(p._id, 11);
        expect(r.status).toBe(200);
        expect(numbers(r.data).slice(0, 2)).toEqual([11, 52]);
        expect(toothOf(r.data, 11)).toMatchObject({ status: 'healthy', surfaces: [], history: [] });
        expect(r.data.replacedTeeth).toEqual([{ toothNumber: 51, replacedAt: expect.any(String) }]);
        expect((await erupt(p._id, 11)).body.code).toBe('toothAlreadyErupted');

        // The new permanent tooth is charted like any other.
        expect((await fill(p._id, 11, 'sealant')).status).toBe(200);
        // A molar without a predecessor is simply added.
        const molar = (await erupt(p._id, 17)).data;
        expect(numbers(molar).slice(0, 7)).toEqual([11, 52, 53, 54, 55, 16, 17]);

        // Undo: 51 is back with its history; 11 is set aside, not lost.
        const undone = (await unerupt(p._id, 11)).data;
        expect(numbers(undone).slice(0, 2)).toEqual([51, 52]);
        expect(toothOf(undone, 51).notes).toBe('caries treated');
        expect(toothOf(undone, 51).history.length).toBeGreaterThan(0);
        // Erupting again brings the same 11 back.
        const redo = (await erupt(p._id, 11)).data;
        expect(toothOf(redo, 11).notes).toBe('sealant');
        expect(redo.replacedTeeth.map((x: any) => x.toothNumber)).toEqual([51]);

        // The chart's tooth history still answers for the replaced tooth's number.
        expect((await t.api.get(`/dental-records/${p._id}/tooth/11/history`, dentist.token)).status).toBe(200);
    });

    it('refuses what does not make sense', async () => {
        const p = await t.addPatient(C.token, 'Refused');
        await chart(p._id); // permanent chart
        expect((await erupt(p._id, 11)).body.code).toBe('notMixedChart');
        await setType(p._id, 'mixed');
        expect((await erupt(p._id, 51)).body.code).toBe('invalidTooth');
        expect((await erupt(p._id, 19)).body.code).toBe('invalidTooth');
        expect((await erupt(p._id, 16)).body.code).toBe('toothAlreadyErupted');
        expect((await unerupt(p._id, 21)).body.code).toBe('toothNotInChart');
        expect((await fill(p._id, 21)).body.code).toBe('toothNotInChart');
        expect((await erupt(p._id, 21, assistant.token)).status).toBe(403);
        expect((await t.api.patch(`/dental-records/${p._id}/chart-type`, dentist.token, { chartType: 'deciduous' })).status).toBe(400);
    });

    it('eruptions are in the audit log', async () => {
        const events = (await t.api.get('/audit?area=chart&limit=100', C.token)).data.items.map((e: any) => e.event);
        expect(events).toEqual(expect.arrayContaining(['chart.eruptTooth', 'chart.uneruptTooth', 'chart.setChartType']));
    });
});
