import * as jwt from 'jsonwebtoken';
import { startApp, TestApp } from './app';

describe('Auth and refresh (e2e)', () => {
    let t: TestApp;

    beforeAll(async () => {
        t = await startApp();
    });
    afterAll(() => t.close());

    it('register returns a working token pair; /auth/me reads the account', async () => {
        const c = await t.registerClinic('Auth');
        const me = await t.api.get('/auth/me', c.token);
        expect(me.status).toBe(200);
        // /auth/me populates the clinic.
        expect(String(me.data.clinicId?._id ?? me.data.clinicId)).toBe(c.clinicId);
        expect(me.data.password).toBeUndefined();
    });

    it('the same email cannot register twice', async () => {
        const c = await t.registerClinic('Dup');
        const me = await t.api.get('/auth/me', c.token);
        const r = await t.api.post('/auth/register', undefined, {
            clinicName: 'Again',
            email: me.data.email.toUpperCase(),
            password: 'ownerpass1',
            firstName: 'A',
            lastName: 'B',
        });
        expect(r.status).toBe(409);
    });

    it('wrong password and unknown email give the same answer', async () => {
        const c = await t.registerClinic('Login');
        const email = (await t.api.get('/auth/me', c.token)).data.email;
        const wrong = await t.login(email, 'nope-nope-1');
        const unknown = await t.login('nobody@e2e.test', 'nope-nope-1');
        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.code).toBe('invalidCredentials');
        expect(unknown.body.code).toBe('invalidCredentials');
    });

    it('rejects missing, malformed, forged and wrongly signed access tokens', async () => {
        const c = await t.registerClinic('Forge');
        const payload = jwt.decode(c.token) as jwt.JwtPayload;

        expect((await t.api.get('/patients')).status).toBe(401);
        expect((await t.api.get('/patients', 'not-a-jwt')).status).toBe(401);
        // The old public default secret must not work.
        const forged = jwt.sign({ ...payload, role: 'super_admin' }, 'dev-access-secret');
        expect((await t.api.get('/patients', forged)).status).toBe(401);
        const expired = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_ACCESS_SECRET!);
        expect((await t.api.get('/patients', expired)).status).toBe(401);
        // A refresh token is not an access token.
        expect((await t.api.get('/patients', c.refreshToken)).status).toBe(401);
    });

    it('a role edited into a correctly signed token is refused: the account is re-read', async () => {
        const c = await t.registerClinic('Role');
        const recep = await t.addStaff(c, 'receptionist');
        const payload = jwt.decode(recep.token) as jwt.JwtPayload;
        const { exp, iat, ...claims } = payload;
        const promoted = jwt.sign({ ...claims, role: 'clinic_admin' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '5m' });
        // Staff management is admin-only.
        const r = await t.api.post('/users', promoted, {
            firstName: 'X',
            lastName: 'Y',
            email: `x-${Date.now()}@e2e.test`,
            password: 'staffpass1',
            role: 'clinic_admin',
        });
        // A role that differs from the account's is a stale token: 401 makes the client refresh.
        expect(r.status).toBe(401);
    });

    describe('refresh rotation', () => {
        it('rotates; the previous token briefly returns the same new token; an older one revokes the session', async () => {
            const c = await t.registerClinic('Rotate');
            const t0 = c.refreshToken;

            const r1 = await t.api.post('/auth/refresh', undefined, { refreshToken: t0 });
            expect(r1.status).toBe(200);
            expect(r1.data.refreshToken).not.toBe(t0);
            expect((await t.api.get('/auth/me', r1.data.accessToken)).status).toBe(200);
            const t1 = r1.data.refreshToken;

            // Another tab presenting t0 within the grace window converges on t1.
            const again = await t.api.post('/auth/refresh', undefined, { refreshToken: t0 });
            expect(again.status).toBe(200);
            expect(again.data.refreshToken).toBe(t1);
            expect((await t.api.get('/auth/me', again.data.accessToken)).status).toBe(200);

            const r2 = await t.api.post('/auth/refresh', undefined, { refreshToken: t1 });
            expect(r2.status).toBe(200);
            const t2 = r2.data.refreshToken;

            // t0 is now two rotations old: it was copied, so the session is revoked.
            const stolen = await t.api.post('/auth/refresh', undefined, { refreshToken: t0 });
            expect(stolen.status).toBe(401);
            expect(stolen.body.code).toBe('sessionRevoked');

            // Including the legitimate latest token and its access token.
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: t2 })).status).toBe(401);
            expect((await t.api.get('/auth/me', r2.data.accessToken)).status).toBe(401);
        });

        it('tabs refreshing with one token at once all get the same new token', async () => {
            const c = await t.registerClinic('Parallel');
            const results = await Promise.all(
                [1, 2, 3, 4].map(() => t.api.post('/auth/refresh', undefined, { refreshToken: c.refreshToken })),
            );
            expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
            expect(new Set(results.map((r) => r.data.refreshToken)).size).toBe(1);
            for (const r of results) expect((await t.api.get('/auth/me', r.data.accessToken)).status).toBe(200);

            const next = await t.api.post('/auth/refresh', undefined, { refreshToken: results[0].data.refreshToken });
            expect(next.status).toBe(200);
        });

        it('rejects garbage, an access token, and a token signed with another secret', async () => {
            const c = await t.registerClinic('Garbage');
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: 'x.y.z' })).status).toBe(401);
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: c.token })).status).toBe(401);
            const payload = jwt.decode(c.refreshToken) as jwt.JwtPayload;
            const forged = jwt.sign(payload, 'dev-refresh-secret');
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: forged })).status).toBe(401);
            expect((await t.api.post('/auth/refresh', undefined, {})).status).toBe(400);
        });
    });

    describe('sessions', () => {
        it('logout ends this device only; logout-all ends every device', async () => {
            const c = await t.registerClinic('Logout');
            const email = (await t.api.get('/auth/me', c.token)).data.email;
            const b = (await t.login(email, 'ownerpass1')).data;
            const d = (await t.login(email, 'ownerpass1')).data;

            expect((await t.api.post('/auth/logout', c.token)).status).toBe(200);
            expect((await t.api.get('/auth/me', c.token)).status).toBe(401);
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: c.refreshToken })).status).toBe(401);
            expect((await t.api.get('/auth/me', b.accessToken)).status).toBe(200);

            expect((await t.api.post('/auth/logout-all', b.accessToken)).status).toBe(200);
            expect((await t.api.get('/auth/me', b.accessToken)).status).toBe(401);
            expect((await t.api.get('/auth/me', d.accessToken)).status).toBe(401);
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: d.refreshToken })).status).toBe(401);
        });

        it('changing the password keeps this device and signs out the others', async () => {
            const c = await t.registerClinic('Pwd');
            const email = (await t.api.get('/auth/me', c.token)).data.email;
            const other = (await t.login(email, 'ownerpass1')).data;

            const wrong = await t.api.post('/auth/change-password', c.token, { currentPassword: 'bad-pass-1', newPassword: 'newpass123' });
            expect(wrong.status).toBe(400);
            expect(wrong.body.code).toBe('wrongCurrentPassword');

            const r = await t.api.post('/auth/change-password', c.token, { currentPassword: 'ownerpass1', newPassword: 'newpass123' });
            expect(r.status).toBe(200);
            expect((await t.api.get('/auth/me', c.token)).status).toBe(200);
            expect((await t.api.get('/auth/me', other.accessToken)).status).toBe(401);
            expect((await t.login(email, 'ownerpass1')).status).toBe(401);
            expect((await t.login(email, 'newpass123')).status).toBe(200);
        });

        it('a deactivated user loses access at once: access token, refresh and login', async () => {
            const c = await t.registerClinic('Deact');
            const s = await t.addStaff(c, 'receptionist');
            const session = (await t.login(s.email, 'staffpass1')).data;

            const r = await t.api.patch(`/users/${s.profile._id}/status`, c.token, { isActive: false });
            expect(r.status).toBe(200);

            expect((await t.api.get('/patients', s.token)).status).toBe(401);
            expect((await t.api.post('/auth/refresh', undefined, { refreshToken: session.refreshToken })).status).toBe(401);
            const again = await t.login(s.email, 'staffpass1');
            expect(again.status).toBe(401);
            expect(again.body.code).toBe('accountDeactivated');
        });

        it('a demoted user loses the old role at once', async () => {
            const c = await t.registerClinic('Demote');
            const second = await t.addStaff(c, 'clinic_admin', 'Second');
            expect((await t.api.get('/reports/revenue', second.token)).status).toBe(200);

            const r = await t.api.patch(`/users/${second.profile._id}`, c.token, { role: 'receptionist' });
            expect(r.status).toBe(200);
            // The old token is stale at once; refreshing gives a token with the new role.
            expect((await t.api.get('/reports/revenue', second.token)).status).toBe(401);
            const session = (await t.login(second.email, 'staffpass1')).data;
            expect((await t.api.get('/reports/revenue', session.accessToken)).status).toBe(403);
            const refreshed = await t.api.post('/auth/refresh', undefined, { refreshToken: session.refreshToken });
            expect(refreshed.data.user.role).toBe('receptionist');
        });

        it('locks an account after repeated wrong passwords', async () => {
            const c = await t.registerClinic('Lock');
            const email = (await t.api.get('/auth/me', c.token)).data.email;
            let last = await t.login(email, 'wrong-pass-0');
            for (let i = 1; i < 12 && last.status !== 429; i++) last = await t.login(email, `wrong-pass-${i}`);
            expect(last.status).toBe(429);
            expect(last.body.code).toBe('accountLocked');
            // Even the right password is refused while locked.
            expect((await t.login(email, 'ownerpass1')).status).toBe(429);
        });
    });
});

describe('Auth rate limits (e2e)', () => {
    let t: TestApp;

    beforeAll(async () => {
        t = await startApp({ throttle: true });
    });
    afterAll(() => t.close());

    it('registration is limited to 5 per hour per address', async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
            const r = await t.api.post('/auth/register', undefined, {
                clinicName: `Limit ${i}`,
                email: `limit-${Date.now()}-${i}@e2e.test`,
                password: 'ownerpass1',
                firstName: 'L',
                lastName: 'M',
            });
            statuses.push(r.status);
        }
        expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
        expect(statuses[5]).toBe(429);
    });
});
