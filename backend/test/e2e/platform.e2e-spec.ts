import { MailService } from 'src/common/mail/mail.service';
import { Clinic, Staff, startApp, TestApp } from './app';

/** F13: the platform console — clinics, trials and end dates, suspension, support views, the platform log, platform admins. */
describe('Platform admin (e2e)', () => {
    let t: TestApp;
    let P: { authId: string; token: string; email: string };
    let C: Clinic;
    let dentist: Staff;
    let mail: MailService;

    /** A day in Yerevan, `days` from today. */
    const day = (days: number) => new Date(Date.now() + 4 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);
    const clinicRow = async (clinicId = C.clinicId, query = '') =>
        (await t.api.get(`/platform/clinics${query}`, P.token)).data.find((c: any) => c._id === clinicId);
    const setEnd = (endsOn: string | null, clinicId = C.clinicId) => t.api.patch(`/platform/clinics/${clinicId}/subscription`, P.token, { endsOn });
    const lastMail = (to: string) => [...mail.outbox].reverse().find((m) => m.to === to);
    const tokenIn = (text: string) => /token=([\w-]+)/.exec(text)?.[1];

    beforeAll(async () => {
        t = await startApp();
        mail = t.app.get(MailService);
        P = await t.addPlatformAdmin();
        C = await t.registerClinic('Platformed');
        dentist = await t.addStaff(C, 'dentist', 'Dina');
        await t.addPatient(C.token);
    });
    afterAll(() => t.close());

    describe('who is who', () => {
        it('a platform admin has no clinic: the console yes, clinic pages no', async () => {
            const me = (await t.api.get('/auth/me', P.token)).data;
            expect(me).toMatchObject({ role: 'super_admin', email: P.email });
            expect(me.clinicId ?? null).toBeNull();
            expect((await t.api.get('/platform/clinics', P.token)).status).toBe(200);
            expect((await t.api.get('/patients', P.token)).status).toBe(403);
            expect((await t.api.get('/auth/sessions', P.token)).status).toBe(200);
        });

        it("a clinic's admin cannot use the console", async () => {
            const r = await t.api.get('/platform/clinics', C.token);
            expect(r.status).toBe(403);
            expect((await t.api.get('/platform/admins', dentist.token)).status).toBe(403);
        });
    });

    describe('clinics', () => {
        it('a new sign-up is on a 30-day trial; the list shows its use', async () => {
            const row = await clinicRow();
            expect(row).toMatchObject({ state: 'trial', subscription: { plan: 'trial', status: 'trial' } });
            const days = (new Date(row.subscription.expiresAt).getTime() - Date.now()) / 86_400_000;
            expect(days).toBeGreaterThan(29);
            expect(days).toBeLessThanOrEqual(30);
            expect(row.usage).toMatchObject({ staff: 2, patients: 1, appointments30: 0, invoices30: 0, documents: 0 });
            expect(row.usage.lastSignIn).toBeTruthy();
        });

        it('search and state filters', async () => {
            const name = (await clinicRow()).name;
            const found = (await t.api.get(`/platform/clinics?search=${encodeURIComponent(name.slice(-6))}`, P.token)).data;
            expect(found.map((c: any) => c._id)).toEqual([C.clinicId]);
            expect((await t.api.get('/platform/clinics?state=suspended', P.token)).data.map((c: any) => c._id)).not.toContain(C.clinicId);
        });

        it('one clinic: admins with two-factor and lock state, staff by role', async () => {
            const c = (await t.api.get(`/platform/clinics/${C.clinicId}`, P.token)).data;
            expect(c.admins).toEqual([expect.objectContaining({ _id: C.userId, twoFactorEnabled: false, locked: false })]);
            expect(c.admins[0]).not.toHaveProperty('password');
            expect(c.staffByRole).toMatchObject({ clinic_admin: 1, dentist: 1 });
            expect((await t.api.get('/platform/clinics/000000000000000000000000', P.token)).body.code).toBe('clinicNotFound');
        });
    });

    describe('end date: warning, then read-only', () => {
        it('ending within a week', async () => {
            const r = await setEnd(day(3));
            expect(r.status).toBe(200);
            expect(r.data.state).toBe('ending');
            const clinic = (await t.api.get('/clinics/current', C.token)).data;
            expect(new Date(clinic.subscription.expiresAt).getTime()).toBeGreaterThan(Date.now());
        });

        it('after the last day the clinic reads but does not change', async () => {
            expect((await setEnd(day(-1))).data.state).toBe('ended');
            expect((await t.api.get('/patients', C.token)).status).toBe(200);
            const write = await t.api.post('/patients', C.token, { firstName: 'Late', lastName: 'Patient', dateOfBirth: '1990-01-01', gender: 'male', phone: '+37491000111' });
            expect(write.status).toBe(403);
            expect(write.body.code).toBe('subscriptionEnded');
            // Still allowed: your own account, exports, and asking support for help.
            expect((await t.api.post('/exports', C.token, { format: 'csv', filename: 'x', sheets: [{ name: 'a', columns: [{ header: 'A', type: 'text' }], rows: [['1']] }] })).status).toBe(200);
            expect((await t.api.put('/clinics/current/support-access', C.token, { hours: 1 })).status).toBe(200);
            await t.api.del('/clinics/current/support-access', C.token);
        });

        it('extending it (or no end) makes it writable again; plan and status are set too', async () => {
            const r = await t.api.patch(`/platform/clinics/${C.clinicId}/subscription`, P.token, { plan: 'standard', status: 'active', endsOn: null });
            expect(r.data).toMatchObject({ state: 'active', subscription: { plan: 'standard', status: 'active' } });
            expect(r.data.subscription.expiresAt).toBeUndefined();
            expect((await t.api.post('/patients', C.token, { firstName: 'Back', lastName: 'Again', dateOfBirth: '1990-01-01', gender: 'male', phone: '+37491000112' })).status).toBe(201);
            expect((await setEnd('2026-02-31')).status).toBe(400);
        });
    });

    describe('suspension', () => {
        it('signs everyone out and keeps them out; reactivating lets them back', async () => {
            const other = await t.registerClinic('ToSuspend');
            const staff = await t.addStaff(other, 'receptionist', 'Rita');
            const r = await t.api.post(`/platform/clinics/${other.clinicId}/suspend`, P.token, { reason: 'Unpaid since October' });
            expect(r.data).toMatchObject({ state: 'suspended', isActive: false, suspendReason: 'Unpaid since October' });
            expect((await t.api.get('/patients', staff.token)).status).toBe(401);
            const login = await t.login(staff.email, 'staffpass1');
            expect(login.status).toBe(403);
            expect(login.body.code).toBe('clinicInactive');
            expect((await t.api.post(`/platform/clinics/${other.clinicId}/suspend`, P.token, { reason: 'again' })).body.code).toBe('clinicAlreadySuspended');
            expect((await t.api.post(`/platform/clinics/${other.clinicId}/suspend`, P.token, {})).status).toBe(400);

            expect((await t.api.post(`/platform/clinics/${other.clinicId}/reactivate`, P.token)).data.state).toBe('trial');
            expect((await t.login(staff.email, 'staffpass1')).status).toBe(200);
            expect((await t.api.post(`/platform/clinics/${other.clinicId}/reactivate`, P.token)).body.code).toBe('clinicNotSuspended');

            // The clinic sees what the platform did to it.
            const fresh = await t.login(`owner-${(await t.api.get(`/platform/clinics/${other.clinicId}`, P.token)).data.email.split('owner-')[1]}`, 'ownerpass1');
            const log = (await t.api.get('/audit?limit=50', fresh.data.accessToken)).data.items;
            const suspended = log.find((e: any) => e.event === 'platform.suspend');
            expect(suspended).toMatchObject({ actor: { kind: 'platform' } });
            expect(suspended.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'isActive', from: true, to: false })]));
        });
    });

    describe('support views', () => {
        it('only while the clinic allows it', async () => {
            const r = await t.api.post(`/platform/clinics/${C.clinicId}/support-session`, P.token);
            expect(r.status).toBe(403);
            expect(r.body.code).toBe('supportAccessOff');
            // Only the clinic's admins can allow it, for 1–72 hours.
            expect((await t.api.put('/clinics/current/support-access', dentist.token, { hours: 4 })).status).toBe(403);
            expect((await t.api.put('/clinics/current/support-access', C.token, { hours: 5 })).status).toBe(400);
        });

        it('read-only, seen as a clinic admin, every screen logged once', async () => {
            const grant = await t.api.put('/clinics/current/support-access', C.token, { hours: 4 });
            expect(new Date(grant.data.supportAccessUntil).getTime()).toBeGreaterThan(Date.now() + 3.9 * 3600_000);

            const s = (await t.api.post(`/platform/clinics/${C.clinicId}/support-session`, P.token)).data;
            expect(s.clinic._id).toBe(C.clinicId);
            // At most an hour per view.
            expect(new Date(s.expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 3600_000 + 1000);

            const me = (await t.api.get('/auth/me', s.accessToken)).data;
            expect(me).toMatchObject({ role: 'clinic_admin', support: { clinicName: expect.stringContaining('Platformed') } });
            const patients = await t.api.get('/patients', s.accessToken);
            expect(patients.status).toBe(200);
            await t.api.get('/patients', s.accessToken);
            const patientId = patients.data.data?.[0]?._id ?? patients.data[0]?._id;
            await t.api.get(`/patients/${patientId}`, s.accessToken);

            const write = await t.api.post('/patients', s.accessToken, { firstName: 'No', lastName: 'Way', dateOfBirth: '1990-01-01', gender: 'male', phone: '+37491000113' });
            expect(write.body.code).toBe('supportReadOnly');
            expect((await t.api.get('/audit?limit=100', s.accessToken)).status).toBe(200);

            const log = (await t.api.get('/audit?limit=100', C.token)).data.items.filter((e: any) => e.event === 'support.view');
            expect(log.every((e: any) => e.actor.kind === 'support' && e.actor.userId === P.authId)).toBe(true);
            // The list once (not twice), the patient's record with the patient, the audit log.
            expect(log.filter((e: any) => e.path === '/api/patients')).toHaveLength(1);
            // Their own account (/auth/me) is not the clinic's record.
            expect(log.some((e: any) => e.path.startsWith('/api/auth'))).toBe(false);
            expect(log.find((e: any) => e.path === '/api/patients/:id')).toMatchObject({ patientId: expect.objectContaining({ _id: patientId }), details: { section: 'patients' } });

            // The platform admin's own sessions don't list support views.
            expect((await t.api.get('/auth/sessions', P.token)).data).toHaveLength(1);

            // Leaving a view is logged as support, not as one of the clinic's admins.
            const other = (await t.api.post(`/platform/clinics/${C.clinicId}/support-session`, P.token)).data;
            expect((await t.api.post('/auth/logout', other.accessToken)).status).toBe(200);
            const left = (await t.api.get('/audit?area=auth&limit=20', C.token)).data.items.find((e: any) => e.event === 'auth.logout');
            expect(left.actor).toMatchObject({ kind: 'support', userId: P.authId, role: 'super_admin' });

            // Withdrawn: the open view ends at once.
            expect((await t.api.del('/clinics/current/support-access', C.token)).data).toEqual({ supportAccessUntil: null });
            const after = await t.api.get('/patients', s.accessToken);
            expect(after.status).toBe(401);
            const events = (await t.api.get('/audit?area=clinic&limit=20', C.token)).data.items.map((e: any) => e.event);
            expect(events).toEqual(expect.arrayContaining(['clinic.grantSupportAccess', 'clinic.revokeSupportAccess']));
        });
    });

    describe('helping admins sign in', () => {
        it('a reset link to a clinic admin; two-factor turned off; not for other staff', async () => {
            const owner = (await t.api.get(`/platform/clinics/${C.clinicId}`, P.token)).data.admins[0];
            const sent = await t.api.post(`/platform/clinics/${C.clinicId}/users/${owner._id}/password-reset`, P.token);
            expect(sent.data).toEqual({ sent: true, email: owner.email });
            expect(tokenIn(lastMail(owner.email)!.text)).toBeTruthy();

            expect((await t.api.post(`/platform/clinics/${C.clinicId}/users/${owner._id}/reset-two-factor`, P.token)).data).toEqual({ reset: true });
            // Signed out everywhere.
            expect((await t.api.get('/patients', C.token)).status).toBe(401);
            C.token = (await t.login(owner.email, 'ownerpass1')).data.accessToken;

            expect((await t.api.post(`/platform/clinics/${C.clinicId}/users/${dentist.authId}/password-reset`, P.token)).status).toBe(404);
        });
    });

    describe('platform admins', () => {
        let B: { _id: string; email: string };

        it('adding one emails a link to choose a password (a day)', async () => {
            const r = await t.api.post('/platform/admins', P.token, { email: 'Second.Admin@e2e.test', firstName: 'Second', lastName: 'Admin' });
            expect(r.status).toBe(201);
            expect(r.data).toMatchObject({ email: 'second.admin@e2e.test', inviteSent: true });
            B = r.data;
            const token = tokenIn(lastMail(B.email)!.text)!;
            expect((await t.api.post('/auth/reset-password', undefined, { token, newPassword: 'secondpass1' })).status).toBe(200);
            const login = await t.login(B.email, 'secondpass1');
            expect(login.data.user).toMatchObject({ role: 'super_admin' });
            expect((await t.api.get('/platform/admins', login.data.accessToken)).data.map((a: any) => a.email)).toEqual([P.email, B.email]);
            expect((await t.api.post('/platform/admins', P.token, { email: B.email, firstName: 'X', lastName: 'Y' })).status).toBe(409);
        });

        it('removing: not yourself; the removed one is signed out', async () => {
            expect((await t.api.del(`/platform/admins/${P.authId}`, P.token)).body.code).toBe('cannotDeactivateSelf');
            const bToken = (await t.login(B.email, 'secondpass1')).data.accessToken;
            expect((await t.api.del(`/platform/admins/${B._id}`, P.token)).data).toEqual({ removed: true });
            expect((await t.api.get('/platform/clinics', bToken)).status).toBe(401);
            expect((await t.api.del(`/platform/admins/${C.userId}`, P.token)).status).toBe(404);
        });
    });

    describe('the platform log', () => {
        it("platform actions (with the clinic's name) and sign-ins everywhere", async () => {
            const platform = (await t.api.get('/platform/audit?kind=platform&limit=200', P.token)).data.items;
            const update = platform.find((e: any) => e.event === 'platform.updateSubscription');
            expect(update).toMatchObject({ actor: { kind: 'platform', userId: P.authId }, clinic: { _id: C.clinicId, name: expect.stringContaining('Platformed') } });
            expect(update.changes.map((c: any) => c.field)).toEqual(expect.arrayContaining(['expiresAt']));
            expect(platform.map((e: any) => e.event)).toEqual(expect.arrayContaining(['platform.addAdmin', 'platform.removeAdmin', 'platform.startSupport', 'support.view']));
            // Adding an admin is about no clinic.
            expect(platform.find((e: any) => e.event === 'platform.addAdmin').clinic).toBeNull();

            const signins = (await t.api.get('/platform/audit?kind=signins&limit=200', P.token)).data.items;
            expect(signins.some((e: any) => e.event === 'auth.login' && e.clinic?._id === C.clinicId)).toBe(true);
            expect(signins.some((e: any) => e.event === 'auth.login' && e.actor.kind === 'platform' && e.clinic === null)).toBe(true);
            expect(signins.some((e: any) => e.event === 'auth.loginFailed' && e.details?.reason === 'clinicSuspended')).toBe(true);

            const one = (await t.api.get(`/platform/audit?clinicId=${C.clinicId}&limit=200`, P.token)).data.items;
            expect(one.every((e: any) => e.clinic?._id === C.clinicId)).toBe(true);
        });
    });
});
