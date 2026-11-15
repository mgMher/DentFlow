import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailService } from 'src/common/mail/mail.service';
import { totpAt, totpStep } from 'src/common/utils';
import { Clinic, Staff, startApp, TestApp } from './app';

/** F9: password reset by email, two-factor sign-in, signed-in devices. */
describe('Account security (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let mail: MailService;
    let users: Model<any>;

    /** The current authenticator code; `ahead` steps later (codes work once, so each sign-in needs a fresh step). */
    const code = (secret: string, ahead = 0) => totpAt(secret, totpStep() + ahead);
    /** Forget the last accepted step, as if half a minute had passed. */
    const nextWindow = (email: string) => users.updateOne({ email }, { $unset: { twoFactorLastStep: '' } });
    const account = async (email: string, select = ''): Promise<any> => users.findOne({ email }).select(select).lean();
    const lastMail = (to: string) => [...mail.outbox].reverse().find((m) => m.to === to);
    const tokenFrom = (text: string) => text.match(/reset-password\?token=([\w-]+)/)![1];

    beforeAll(async () => {
        t = await startApp();
        mail = t.app.get(MailService);
        users = t.app.get(getModelToken('User'));
        C = await t.registerClinic('Secure');
    });
    afterAll(() => {
        process.env.TWO_FACTOR_REQUIRED_ROLES = 'none';
        return t.close();
    });

    describe('password reset by email', () => {
        let staff: Staff;
        beforeAll(async () => {
            staff = await t.addStaff(C, 'receptionist', 'Forgetful');
        });

        it('answers the same for unknown emails and sends nothing', async () => {
            const before = mail.outbox.length;
            const r = await t.api.post('/auth/forgot-password', undefined, { email: 'nobody@e2e.test' });
            expect(r.status).toBe(200);
            expect(r.data).toEqual({ sent: true });
            expect(mail.outbox.length).toBe(before);
        });

        it('emails a one-time link in the clinic language; the new password works and every device is signed out', async () => {
            const r = await t.api.post('/auth/forgot-password', undefined, { email: staff.email.toUpperCase() });
            expect(r.data).toEqual({ sent: true });
            const m = lastMail(staff.email)!;
            expect(m.subject).toContain('DentFlow');
            expect(m.text).toContain('Forgetful');
            expect(m.text).toMatch(/գաղտնաբառ/); // the clinic language (hy)
            const token = tokenFrom(m.text);

            const stored = await account(staff.email, '+resetTokenHash');
            expect(stored.resetTokenHash).toBeDefined();
            expect(stored.resetTokenHash).not.toContain(token);

            const done = await t.api.post('/auth/reset-password', undefined, { token, newPassword: 'brandnew123' });
            expect(done.data).toEqual({ reset: true });
            expect((await t.api.get('/auth/me', staff.token)).status).toBe(401);
            expect((await t.login(staff.email, 'staffpass1')).status).toBe(401);
            expect((await t.login(staff.email, 'brandnew123')).status).toBe(200);

            const again = await t.api.post('/auth/reset-password', undefined, { token, newPassword: 'another1234' });
            expect(again.body.code).toBe('resetLinkInvalid');
        });

        it('a link stops working after an hour, and a newer link replaces an older one', async () => {
            await t.api.post('/auth/forgot-password', undefined, { email: staff.email });
            const first = tokenFrom(lastMail(staff.email)!.text);
            await t.api.post('/auth/forgot-password', undefined, { email: staff.email });
            const second = tokenFrom(lastMail(staff.email)!.text);
            expect((await t.api.post('/auth/reset-password', undefined, { token: first, newPassword: 'nope12345' })).body.code).toBe('resetLinkInvalid');

            await users.updateOne({ email: staff.email }, { $set: { resetTokenExpiresAt: new Date(Date.now() - 1000) } });
            expect((await t.api.post('/auth/reset-password', undefined, { token: second, newPassword: 'nope12345' })).body.code).toBe('resetLinkInvalid');
        });

        it('weak passwords are refused; requests and resets are in the audit log', async () => {
            await t.api.post('/auth/forgot-password', undefined, { email: staff.email });
            const token = tokenFrom(lastMail(staff.email)!.text);
            expect((await t.api.post('/auth/reset-password', undefined, { token, newPassword: '123' })).status).toBe(400);
            const log = (await t.api.get(`/audit?area=auth&userId=${staff.authId}&limit=20`, C.token)).data.items.map((e: any) => e.event);
            expect(log).toEqual(expect.arrayContaining(['auth.passwordResetRequested', 'auth.passwordReset']));
        });
    });

    describe('two-factor sign-in (optional for staff)', () => {
        let staff: Staff;
        let secret: string;
        let backupCodes: string[];

        beforeAll(async () => {
            staff = await t.addStaff(C, 'dentist', 'Careful');
        });

        it('setup: a secret and QR code; the first code switches it on and gives 10 backup codes once', async () => {
            // Two requests at once (React runs effects twice in development) agree on one secret.
            const [s, again] = (await Promise.all([t.api.post('/auth/2fa/setup', staff.token), t.api.post('/auth/2fa/setup', staff.token)])).map((r) => r.data);
            expect(again.secret).toBe(s.secret);
            expect((await t.api.post('/auth/2fa/setup', staff.token)).data.secret).toBe(s.secret);
            expect(s.secret).toMatch(/^[A-Z2-7]{32}$/);
            expect(s.otpauthUrl).toContain('otpauth://totp/DentFlow');
            expect(s.qr).toMatch(/^data:image\/png;base64,/);
            secret = s.secret;

            expect((await t.api.post('/auth/2fa/enable', staff.token, { code: '000000' })).body.code).toBe('twoFactorCodeInvalid');
            const on = await t.api.post('/auth/2fa/enable', staff.token, { code: code(secret) });
            expect(on.status).toBe(200);
            backupCodes = on.data.backupCodes;
            expect(backupCodes).toHaveLength(10);
            expect(backupCodes[0]).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);

            expect((await t.api.get('/auth/2fa', staff.token)).data).toMatchObject({ enabled: true, required: false, backupCodesLeft: 10 });
            expect((await t.api.get('/auth/me', staff.token)).data).toMatchObject({ twoFactorEnabled: true, twoFactorRequired: false });
            const stored = await account(staff.email, '+twoFactorSecretSealed');
            expect(stored.twoFactorSecretSealed).not.toContain(secret);
            // The audit log notes the steps, never the secret or the codes.
            const log = JSON.stringify((await t.api.get(`/audit?userId=${staff.authId}&limit=10`, C.token)).data.items);
            expect(log).toContain('auth.enableTwoFactor');
            expect(log).not.toContain(secret);
            expect(log).not.toContain(backupCodes[0]);
        });

        it('sign-in now stops after the password; a wrong code is refused and counts as a failed attempt', async () => {
            const first = await t.login(staff.email, 'staffpass1');
            expect(first.data).toEqual({ twoFactorRequired: true, twoFactorSetupRequired: false, challenge: expect.any(String) });
            expect(first.data.accessToken).toBeUndefined();

            const wrong = await t.api.post('/auth/login/2fa', undefined, { challenge: first.data.challenge, code: '123456' });
            expect(wrong.status).toBe(401);
            expect(wrong.body.code).toBe('twoFactorCodeInvalid');
            expect((await account(staff.email)).failedLoginAttempts).toBe(1);

            await nextWindow(staff.email);
            const ok = await t.api.post('/auth/login/2fa', undefined, { challenge: first.data.challenge, code: code(secret) });
            expect(ok.status).toBe(200);
            expect(ok.data.accessToken).toBeDefined();
            expect((await account(staff.email)).failedLoginAttempts).toBe(0);
        });

        it('each code works once; a backup code works once', async () => {
            const c = code(secret, 1);
            const a = await t.login(staff.email, 'staffpass1');
            expect((await t.api.post('/auth/login/2fa', undefined, { challenge: a.data.challenge, code: c })).status).toBe(200);
            const b = await t.login(staff.email, 'staffpass1');
            expect((await t.api.post('/auth/login/2fa', undefined, { challenge: b.data.challenge, code: c })).status).toBe(401);

            const viaBackup = await t.api.post('/auth/login/2fa', undefined, { challenge: b.data.challenge, code: backupCodes[0].toUpperCase() });
            expect(viaBackup.status).toBe(200);
            const reuse = await t.login(staff.email, 'staffpass1');
            expect((await t.api.post('/auth/login/2fa', undefined, { challenge: reuse.data.challenge, code: backupCodes[0] })).status).toBe(401);
            expect((await t.api.get('/auth/2fa', viaBackup.data.accessToken)).data.backupCodesLeft).toBe(9);
        });

        it('a trusted device skips the code for 30 days until "log out everywhere"', async () => {
            await nextWindow(staff.email);
            const a = await t.login(staff.email, 'staffpass1');
            const ok = await t.api.post('/auth/login/2fa', undefined, { challenge: a.data.challenge, code: code(secret), trustDevice: true });
            const trustedDevice = ok.data.trustedDevice;
            expect(trustedDevice).toMatch(/^[\w-]{40,}$/);

            const skip = await t.api.post('/auth/login', undefined, { email: staff.email, password: 'staffpass1', trustedDevice });
            expect(skip.data.accessToken).toBeDefined();
            expect((await t.api.post('/auth/login', undefined, { email: staff.email, password: 'staffpass1', trustedDevice: 'made-up' })).data.twoFactorRequired).toBe(true);

            await t.api.post('/auth/logout-all', skip.data.accessToken);
            expect((await t.api.post('/auth/login', undefined, { email: staff.email, password: 'staffpass1', trustedDevice })).data.twoFactorRequired).toBe(true);
        });

        it('new backup codes replace the old; it can be switched off with a code', async () => {
            await nextWindow(staff.email);
            const a = await t.login(staff.email, 'staffpass1');
            const s = (await t.api.post('/auth/login/2fa', undefined, { challenge: a.data.challenge, code: backupCodes[1] })).data;
            await nextWindow(staff.email);
            const fresh = (await t.api.post('/auth/2fa/backup-codes', s.accessToken, { code: code(secret) })).data.backupCodes;
            expect(fresh).toHaveLength(10);
            const old = await t.login(staff.email, 'staffpass1');
            expect((await t.api.post('/auth/login/2fa', undefined, { challenge: old.data.challenge, code: backupCodes[2] })).status).toBe(401);

            expect((await t.api.post('/auth/2fa/disable', s.accessToken, { code: '999999' })).body.code).toBe('twoFactorCodeInvalid');
            expect((await t.api.post('/auth/2fa/disable', s.accessToken, { code: fresh[0] })).data).toEqual({ enabled: false });
            expect((await t.login(staff.email, 'staffpass1')).data.accessToken).toBeDefined();
        });
    });

    describe('required for admins', () => {
        let admin: Staff;
        let secret: string;

        beforeAll(async () => {
            process.env.TWO_FACTOR_REQUIRED_ROLES = 'super_admin,clinic_admin';
            admin = await t.addStaff(C, 'clinic_admin', 'Boss');
        });
        afterAll(() => {
            process.env.TWO_FACTOR_REQUIRED_ROLES = 'none';
        });

        it('an admin without it must set it up before getting in', async () => {
            const first = await t.login(admin.email, 'staffpass1');
            expect(first.data).toEqual({ twoFactorRequired: false, twoFactorSetupRequired: true, challenge: expect.any(String) });
            // The setup ticket is not a code ticket, and a made-up one is refused.
            expect((await t.api.post('/auth/login/2fa', undefined, { challenge: first.data.challenge, code: '123456' })).body.code).toBe('twoFactorChallengeExpired');
            expect((await t.api.post('/auth/login/2fa/setup', undefined, { challenge: 'forged' })).body.code).toBe('twoFactorChallengeExpired');

            const s = (await t.api.post('/auth/login/2fa/setup', undefined, { challenge: first.data.challenge })).data;
            secret = s.secret;
            const done = await t.api.post('/auth/login/2fa/enable', undefined, { challenge: first.data.challenge, code: code(secret) });
            expect(done.status).toBe(200);
            expect(done.data.accessToken).toBeDefined();
            expect(done.data.backupCodes).toHaveLength(10);
            expect((await t.api.get('/auth/me', done.data.accessToken)).data).toMatchObject({ twoFactorEnabled: true, twoFactorRequired: true });

            // Required: cannot be switched off.
            await nextWindow(admin.email);
            const off = await t.api.post('/auth/2fa/disable', done.data.accessToken, { code: code(secret) });
            expect(off.body.code).toBe('twoFactorRequired');
        });

        it('a receptionist is still optional', async () => {
            const r = await t.addStaff(C, 'receptionist', 'Free');
            expect((await t.login(r.email, 'staffpass1')).data.accessToken).toBeDefined();
        });

        it('lost phone: another admin resets it; the person is signed out and sets it up again', async () => {
            await nextWindow(admin.email);
            const a = await t.login(admin.email, 'staffpass1');
            const session = (await t.api.post('/auth/login/2fa', undefined, { challenge: a.data.challenge, code: code(secret) })).data;

            const reset = await t.api.post(`/users/${admin.profile._id}/reset-two-factor`, C.token);
            expect(reset.data).toEqual({ reset: true });
            expect((await t.api.get('/auth/me', session.accessToken)).status).toBe(401);
            expect((await t.login(admin.email, 'staffpass1')).data.twoFactorSetupRequired).toBe(true);

            const own = await t.api.post(`/users/${admin.profile._id}/reset-two-factor`, session.accessToken);
            expect(own.status).toBe(401); // signed out above
        });
    });

    describe('devices', () => {
        let staff: Staff;
        beforeAll(async () => {
            staff = await t.addStaff(C, 'assistant', 'Many');
        });

        it('lists my signed-in devices and signs out one of them', async () => {
            const second = (await t.login(staff.email, 'staffpass1')).data;
            const list = (await t.api.get('/auth/sessions', staff.token)).data;
            expect(list).toHaveLength(2);
            expect(list.filter((s: any) => s.current)).toHaveLength(1);
            const other = list.find((s: any) => !s.current);
            expect(other).toMatchObject({ userAgent: expect.any(String), lastUsedAt: expect.any(String) });

            expect((await t.api.del(`/auth/sessions/${other._id}`, staff.token)).data).toEqual({ revoked: true });
            expect((await t.api.get('/auth/me', second.accessToken)).status).toBe(401);
            expect((await t.api.get('/auth/me', staff.token)).status).toBe(200);
            expect((await t.api.del(`/auth/sessions/${other._id}`, staff.token)).body.code).toBe('sessionNotFound');
        });

        it("someone else's device cannot be signed out through my account", async () => {
            const someone = await t.addStaff(C, 'assistant', 'Someone');
            const theirs = (await t.api.get('/auth/sessions', someone.token)).data[0];
            expect((await t.api.del(`/auth/sessions/${theirs._id}`, staff.token)).status).toBe(404);
            expect((await t.api.get('/auth/me', someone.token)).status).toBe(200);
        });

        it('an admin signs a staff member out of every device; others may not', async () => {
            const target = await t.addStaff(C, 'dentist', 'Target');
            const recep = await t.addStaff(C, 'receptionist', 'Nosy');
            expect((await t.api.post(`/users/${target.profile._id}/sign-out-everywhere`, recep.token)).status).toBe(403);
            expect((await t.api.post(`/users/${target.profile._id}/sign-out-everywhere`, C.token)).data).toEqual({ signedOut: true });
            expect((await t.api.get('/auth/me', target.token)).status).toBe(401);
            const other = await t.registerClinic('OtherSecure');
            expect((await t.api.post(`/users/${recep.profile._id}/sign-out-everywhere`, other.token)).status).toBe(404);
            const log = (await t.api.get('/audit?area=staff&limit=5', C.token)).data.items.map((e: any) => e.event);
            expect(log).toContain('staff.signOutEverywhere');
        });
    });
});
