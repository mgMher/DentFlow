import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getConnectionToken } from '@nestjs/mongoose';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';

export interface Res<T = any> {
    status: number;
    body: any;
    data: T;
}

type Body = Record<string, unknown> | unknown[];

export interface Clinic {
    clinicId: string;
    /** The founding admin. */
    token: string;
    refreshToken: string;
    userId: string;
}

export interface Staff {
    /** The staff profile (`/users/:id`). */
    profile: any;
    /** The login account, which appointments reference as the dentist. */
    authId: string;
    token: string;
    email: string;
}

let seq = 0;
/** Unique within one run; mixed with time so reruns against a kept database don't collide. */
const unique = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * The whole API on a random port against a throwaway database (see env.ts).
 * Rate limits are off unless `throttle` is set, so a file can register as many
 * clinics as it needs.
 */
export async function startApp({ throttle = false } = {}) {
    let builder = Test.createTestingModule({ imports: [AppModule] });
    if (!throttle) builder = builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
    const moduleRef = await builder.compile();

    const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address();
    const url = `http://127.0.0.1:${port}/api`;

    async function call<T = any>(method: string, path: string, opts: { token?: string; body?: Body } = {}): Promise<Res<T>> {
        const res = await fetch(url + path, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
            },
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        const text = await res.text();
        let body: any = null;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = text;
        }
        return { status: res.status, body, data: body?.data };
    }

    const api = {
        get: <T = any>(path: string, token?: string) => call<T>('GET', path, { token }),
        post: <T = any>(path: string, token?: string, body?: Body) => call<T>('POST', path, { token, body }),
        patch: <T = any>(path: string, token?: string, body?: Body) => call<T>('PATCH', path, { token, body }),
        del: <T = any>(path: string, token?: string) => call<T>('DELETE', path, { token }),
    };

    async function registerClinic(name = 'Clinic'): Promise<Clinic> {
        const u = unique();
        const r = await api.post('/auth/register', undefined, {
            clinicName: `${name} ${u}`,
            email: `owner-${u}@e2e.test`,
            password: 'ownerpass1',
            firstName: 'Owner',
            lastName: name,
        });
        if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
        return {
            clinicId: String(r.data.user.clinicId),
            token: r.data.accessToken,
            refreshToken: r.data.refreshToken,
            userId: String(r.data.user._id),
        };
    }

    async function login(email: string, password: string) {
        return api.post('/auth/login', undefined, { email, password });
    }

    async function addStaff(admin: Clinic, role: string, firstName = role): Promise<Staff> {
        const email = `${firstName}-${unique()}@e2e.test`.toLowerCase();
        const r = await api.post('/users', admin.token, { firstName, lastName: 'Staff', email, password: 'staffpass1', role });
        if (r.status !== 201) throw new Error(`add staff failed: ${JSON.stringify(r.body)}`);
        const session = await login(email, 'staffpass1');
        return { profile: r.data, authId: String(r.data.authId), token: session.data.accessToken, email };
    }

    async function addPatient(token: string, firstName = 'Anna') {
        const r = await api.post('/patients', token, {
            firstName,
            lastName: `P${unique()}`,
            dateOfBirth: '1990-01-01',
            gender: 'female',
            phone: '+3749' + String(Date.now() + seq++).slice(-7),
        });
        if (r.status !== 201) throw new Error(`add patient failed: ${JSON.stringify(r.body)}`);
        return r.data;
    }

    async function close() {
        const connection = moduleRef.get<Connection>(getConnectionToken());
        // Index builds run in the background; one finishing after the drop recreates the database.
        await Promise.all(connection.modelNames().map((name) => connection.model(name).init()));
        await connection.dropDatabase();
        await app.close();
    }

    return { app, url, api, call, registerClinic, login, addStaff, addPatient, close };
}

export type TestApp = Awaited<ReturnType<typeof startApp>>;

/** An ISO time `days` from now at `hour:minute` UTC, rounded to the minute. */
export function at(days: number, hour: number, minute = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
}
