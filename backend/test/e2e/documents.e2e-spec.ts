import { readdir } from 'fs/promises';
import { join } from 'path';
import { Clinic, Staff, startApp, TestApp } from './app';

/** F6: X-rays and documents per patient and per tooth, stored as files behind the API. */
describe('Patient documents (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let dentist: Staff, assistant: Staff, recep: Staff;
    let patient: any;

    const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 300 }, (_, i) => i % 251), 0xff, 0xd9]);
    const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 100 }, () => 7)]);
    const pdf = () => new TextEncoder().encode('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
    const dicom = () => new Uint8Array([...new Array(128).fill(0), ...new TextEncoder().encode('DICM'), 2, 0, 0, 0]);
    const exe = () => new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...new Array(64).fill(1)]);

    /** Multipart upload as the browser sends it. */
    const upload = async (
        token: string,
        patientId: string,
        bytes: Uint8Array,
        fields: Record<string, string> = {},
        name = 'scan.jpg',
        type = 'image/jpeg',
    ) => {
        const form = new FormData();
        form.append('file', new Blob([bytes as Uint8Array<ArrayBuffer>], { type }), name);
        for (const [k, v] of Object.entries({ kind: 'xray', ...fields })) form.append(k, v);
        const res = await fetch(`${t.url}/patients/${patientId}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
        const body = await res.json().catch(() => null);
        return { status: res.status, body, data: body?.data };
    };
    /** Files stored for the clinic, at any depth. */
    const storedFiles = async (dir: string): Promise<number> => {
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        let n = 0;
        for (const e of entries) n += e.isDirectory() ? await storedFiles(join(dir, e.name)) : 1;
        return n;
    };
    const download = (token: string, id: string) => fetch(`${t.url}/documents/${id}/file`, { headers: { Authorization: `Bearer ${token}` } });

    beforeAll(async () => {
        t = await startApp();
        C = await t.registerClinic('Docs');
        dentist = await t.addStaff(C, 'dentist');
        assistant = await t.addStaff(C, 'assistant');
        recep = await t.addStaff(C, 'receptionist');
        patient = await t.addPatient(C.token, 'Xray');
    });
    afterAll(() => t.close());

    it('uploads an X-ray for a tooth and serves the same bytes back', async () => {
        const bytes = jpeg();
        const r = await upload(assistant.token, patient._id, bytes, { teeth: '36,37', takenAt: '2026-11-10', notes: 'Bitewing' }, 'bitewing.jpg');
        expect(r.status).toBe(201);
        expect(r.data).toMatchObject({ kind: 'xray', title: 'bitewing.jpg', teeth: [36, 37], notes: 'Bitewing' });
        expect(r.data.file).toMatchObject({ mimeType: 'image/jpeg', size: bytes.length, viewable: true, originalName: 'bitewing.jpg' });
        expect(r.data.file.key).toBeUndefined();
        expect(r.data.uploadedBy.firstName).toBe('assistant');

        const res = await download(dentist.token, r.data._id);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/jpeg');
        expect(res.headers.get('content-disposition')).toContain('bitewing.jpg');
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    });

    it('takes PNG, PDF and DICOM (DICOM is download-only); the type comes from the bytes', async () => {
        const p = await upload(recep.token, patient._id, png(), { kind: 'photo' }, 'smile.png', 'image/png');
        expect(p.data.file.mimeType).toBe('image/png');
        const d = await upload(recep.token, patient._id, pdf(), { kind: 'consent', title: 'Consent form' }, 'consent.pdf', 'application/pdf');
        expect(d.data).toMatchObject({ kind: 'consent', title: 'Consent form', file: { mimeType: 'application/pdf', viewable: true } });
        const m = await upload(dentist.token, patient._id, dicom(), { teeth: '11' }, 'ct.dcm', 'application/octet-stream');
        expect(m.data.file).toMatchObject({ mimeType: 'application/dicom', viewable: false });
        // Claimed JPEG, really a PNG: stored as what it is.
        const liar = await upload(recep.token, patient._id, png(), { kind: 'photo' }, 'liar.jpg', 'image/jpeg');
        expect(liar.data.file.mimeType).toBe('image/png');
    });

    it('refuses executables dressed up as images, empty uploads, files over the limit and bad teeth', async () => {
        const fake = await upload(recep.token, patient._id, exe(), {}, 'xray.jpg', 'image/jpeg');
        expect(fake.status).toBe(400);
        expect(fake.body.code).toBe('unsupportedFileType');
        const none = await fetch(`${t.url}/patients/${patient._id}/documents`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${recep.token}` },
            body: (() => { const f = new FormData(); f.append('kind', 'xray'); return f; })(),
        });
        expect((await none.json()).code).toBe('fileRequired');
        const big = new Uint8Array(1024 * 1024 + 10);
        big.set([0xff, 0xd8, 0xff]);
        const tooBig = await upload(recep.token, patient._id, big);
        expect(tooBig.status).toBe(413);
        const badTooth = await upload(recep.token, patient._id, jpeg(), { teeth: '19' });
        expect(badTooth.body.code).toBe('invalidTooth');
        const badKind = await upload(recep.token, patient._id, jpeg(), { kind: 'selfie' });
        expect(badKind.status).toBe(400);
    });

    it('lists newest first, by kind and by tooth', async () => {
        const all = (await t.api.get(`/patients/${patient._id}/documents`, assistant.token)).data;
        expect(all.length).toBeGreaterThanOrEqual(5);
        expect(all.every((d: any) => d.file.key === undefined)).toBe(true);
        const tooth36 = (await t.api.get(`/patients/${patient._id}/documents?tooth=36`, assistant.token)).data;
        expect(tooth36.map((d: any) => d.title)).toEqual(['bitewing.jpg']);
        const consents = (await t.api.get(`/patients/${patient._id}/documents?kind=consent`, assistant.token)).data;
        expect(consents.map((d: any) => d.title)).toEqual(['Consent form']);
    });

    it('the uploader or a dentist may correct details; others may not', async () => {
        const doc = (await upload(assistant.token, patient._id, jpeg(), { teeth: '46' }, 'periapical.jpg')).data;
        const own = await t.api.patch(`/documents/${doc._id}`, assistant.token, { title: 'Periapical 46', teeth: [46, 47] });
        expect(own.data).toMatchObject({ title: 'Periapical 46', teeth: [46, 47] });
        const other = await t.api.patch(`/documents/${doc._id}`, recep.token, { title: 'Changed' });
        expect(other.status).toBe(403);
        expect(other.body.code).toBe('documentEditForbidden');
        const byDentist = await t.api.patch(`/documents/${doc._id}`, dentist.token, { kind: 'photo' });
        expect(byDentist.data.kind).toBe('photo');
    });

    it('removing hides the document but keeps the file; only clinicians remove', async () => {
        const doc = (await upload(recep.token, patient._id, jpeg(), {}, 'wrong-patient.jpg')).data;
        const clinicDir = join(process.env.UPLOAD_DIR!, C.clinicId);
        const before = await storedFiles(clinicDir);
        const byRecep = await t.call('DELETE', `/documents/${doc._id}`, { token: recep.token, body: { reason: 'Wrong patient' } });
        expect(byRecep.status).toBe(403);
        const r = await t.call('DELETE', `/documents/${doc._id}`, { token: dentist.token, body: { reason: 'Wrong patient' } });
        expect(r.status).toBe(200);
        expect((await download(dentist.token, doc._id)).status).toBe(404);
        const list = (await t.api.get(`/patients/${patient._id}/documents`, dentist.token)).data;
        expect(list.find((d: any) => d._id === doc._id)).toBeUndefined();
        // Still on disk: part of the record.
        expect(before).toBeGreaterThan(0);
        expect(await storedFiles(clinicDir)).toBe(before);
    });

    it("another clinic can neither see, download, change nor add to this clinic's documents", async () => {
        const doc = (await upload(recep.token, patient._id, jpeg(), {}, 'private.jpg')).data;
        const other = await t.registerClinic('OtherDocs');
        expect((await t.api.get(`/patients/${patient._id}/documents`, other.token)).status).toBe(404);
        expect((await t.api.get(`/documents/${doc._id}`, other.token)).status).toBe(404);
        expect((await download(other.token, doc._id)).status).toBe(404);
        expect((await t.api.patch(`/documents/${doc._id}`, other.token, { title: 'Hacked' })).status).toBe(404);
        expect((await upload(other.token, patient._id, jpeg())).status).toBe(404);
        expect((await download('', doc._id)).status).toBe(401);
    });
});
