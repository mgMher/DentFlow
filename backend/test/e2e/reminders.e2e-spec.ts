import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RemindersService } from 'src/modules/reminders/reminders.service';
import { ReminderSettings } from 'src/modules/reminders/reminder.schemas';
import { Appointment } from 'src/modules/appointments/appointment.schema';
import { at, Clinic, Staff, startApp, TestApp } from './app';

/** What the fake Telegram / Twilio received. */
interface Call {
    service: 'telegram' | 'twilio';
    method: string;
    body: any;
}

const GOOD_TOKEN = '123456:AAE-fake-token-for-tests-only';
const BAD_TOKEN = '999999:AAE-this-token-is-not-accepted';

/** A local stand-in for api.telegram.org and api.twilio.com. */
function fakeProviders() {
    const calls: Call[] = [];
    let messageId = 100;
    const read = (req: IncomingMessage) =>
        new Promise<string>((resolve) => {
            let data = '';
            req.on('data', (c) => (data += c));
            req.on('end', () => resolve(data));
        });
    const server: Server = createServer(async (req, res) => {
        const raw = await read(req);
        const json = (status: number, body: unknown) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        const tg = req.url!.match(/^\/bot([^/]+)\/(\w+)$/);
        if (tg) {
            const [, token, method] = tg;
            const body = raw ? JSON.parse(raw) : {};
            calls.push({ service: 'telegram', method, body });
            if (token !== GOOD_TOKEN) return json(401, { ok: false, description: 'Unauthorized' });
            if (method === 'getMe') return json(200, { ok: true, result: { id: 1, username: 'dentflow_test_bot' } });
            if (method === 'sendMessage' && body.chat_id === 'blocked') {
                return json(403, { ok: false, description: 'Forbidden: bot was blocked by the user' });
            }
            if (method === 'sendMessage') return json(200, { ok: true, result: { message_id: messageId++ } });
            return json(200, { ok: true, result: true });
        }
        if (req.url!.startsWith('/2010-04-01/Accounts/')) {
            const body = Object.fromEntries(new URLSearchParams(raw));
            calls.push({ service: 'twilio', method: 'Messages', body });
            if (body.To === '+37499000000') return json(400, { code: 21211, message: "The 'To' number is not valid" });
            return json(201, { sid: `SM${messageId++}` });
        }
        json(404, {});
    });
    return { server, calls };
}

describe('Reminders (e2e)', () => {
    let t: TestApp;
    let C: Clinic;
    let recep: Staff, dentist: Staff;
    let fake: ReturnType<typeof fakeProviders>;
    let reminders: RemindersService;
    let settingsModel: Model<ReminderSettings>;
    let appointmentModel: Model<Appointment>;
    let day: string;

    /** `HH:MM` Yerevan time (UTC+4) on `date` as a Date. */
    const local = (date: string, hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h - 4, m));
    };
    const dayBefore = (date: string) => new Date(new Date(`${date}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    const sent = (method: string) => fake.calls.filter((c) => c.method === method);
    const book = async (patient: any, hhmm: string, date = day) => {
        const start = local(date, hhmm);
        const r = await t.api.post('/appointments', recep.token, {
            patientId: patient._id,
            dentistId: dentist.authId,
            startTime: start.toISOString(),
            endTime: new Date(start.getTime() + 30 * 60_000).toISOString(),
            allowOutsideHours: true,
        });
        expect(r.status).toBe(201);
        return r.data;
    };
    const webhookSecret = async () => (await settingsModel.findOne({}).lean())!.telegramWebhookSecret;
    const webhook = async (update: unknown, secret?: string) =>
        fetch(`${t.url}/telegram/webhook/${C.clinicId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret ?? (await webhookSecret()) },
            body: JSON.stringify(update),
        });
    /** The webhook answers before the update is handled; give it a moment. */
    const settle = () => new Promise((r) => setTimeout(r, 300));
    const linkPatient = async (patient: any, chatId: string) => {
        const link = await t.api.post(`/reminders/patients/${patient._id}/telegram-link`, recep.token);
        const code = link.data.link.split('start=')[1];
        await webhook({ update_id: 1, message: { message_id: 1, chat: { id: chatId }, text: `/start ${code}` } });
        await settle();
    };
    const logFor = async (appointmentId: string) => (await t.api.get(`/reminders/appointments/${appointmentId}`, C.token)).data;

    beforeAll(async () => {
        fake = fakeProviders();
        await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
        process.env.TELEGRAM_API_BASE = base;
        process.env.TWILIO_API_BASE = base;

        t = await startApp();
        reminders = t.app.get(RemindersService);
        settingsModel = t.app.get(getModelToken(ReminderSettings.name));
        appointmentModel = t.app.get(getModelToken(Appointment.name));
        C = await t.registerClinic('Remind');
        recep = await t.addStaff(C, 'receptionist');
        dentist = await t.addStaff(C, 'dentist', 'Remi');
        day = at(5, 8).slice(0, 10);
    });
    afterAll(async () => {
        await t.close();
        await new Promise((r) => fake.server.close(r));
    });

    describe('settings', () => {
        it('start switched off; only admins see or change them', async () => {
            const r = await t.api.get('/reminders/settings', C.token);
            expect(r.data).toMatchObject({ enabled: false, dayBeforeTime: '10:00', telegram: { connected: false }, sms: { provider: 'off' } });
            expect((await t.api.get('/reminders/settings', recep.token)).status).toBe(403);
            expect((await t.api.put('/reminders/settings', recep.token, { enabled: true })).status).toBe(403);
        });

        it('a bot token is checked with Telegram and never returned', async () => {
            const bad = await t.call('PUT', '/reminders/settings', { token: C.token, body: { telegramBotToken: BAD_TOKEN } });
            expect(bad.status).toBe(400);
            expect(bad.body.code).toBe('telegramTokenInvalid');
            const good = await t.call('PUT', '/reminders/settings', { token: C.token, body: { telegramBotToken: GOOD_TOKEN } });
            expect(good.status).toBe(200);
            expect(good.data.telegram).toMatchObject({ connected: true, botUsername: 'dentflow_test_bot' });
            // A save answers like a read (the page uses either).
            expect(good.data).toMatchObject({ language: 'hy', placeholders: expect.arrayContaining(['patient', 'time']) });
            expect(good.data.defaultText).toContain('{{patient}}');
            expect(JSON.stringify(good.body)).not.toContain(GOOD_TOKEN);
            const stored = await settingsModel.findOne({}).lean();
            expect(stored!.telegramBotTokenSealed).toBeDefined();
            expect(stored!.telegramBotTokenSealed).not.toContain(GOOD_TOKEN);
            // F7: the audit log says the token changed, never what it is.
            const log = (await t.api.get('/audit?area=reminders&limit=1', C.token)).data.items[0];
            expect(log.event).toBe('reminders.updateSettings');
            expect(log.changes).toEqual(expect.arrayContaining([{ field: 'telegramBotToken', masked: true }]));
            expect(JSON.stringify(log)).not.toContain(GOOD_TOKEN);
        });

        it('Twilio credentials: the auth token is kept sealed; night-time sending is refused', async () => {
            const r = await t.call('PUT', '/reminders/settings', {
                token: C.token,
                body: { smsProvider: 'twilio', twilioAccountSid: 'ACtest', twilioAuthToken: 'secret-auth-token', twilioFrom: '+15005550006' },
            });
            expect(r.data.sms).toMatchObject({ provider: 'twilio', twilioAccountSid: 'ACtest', hasAuthToken: true });
            expect(JSON.stringify(r.body)).not.toContain('secret-auth-token');
            const night = await t.call('PUT', '/reminders/settings', { token: C.token, body: { dayBeforeTime: '23:00' } });
            expect(night.body.code).toBe('reminderTimeAtNight');
            const on = await t.call('PUT', '/reminders/settings', { token: C.token, body: { enabled: true } });
            expect(on.data.enabled).toBe(true);
        });
    });

    describe('linking Telegram', () => {
        it('the patient opens a one-time link; the bot greets them; the link cannot be reused', async () => {
            const p = await t.addPatient(C.token, 'Linky');
            const link = await t.api.post(`/reminders/patients/${p._id}/telegram-link`, recep.token);
            expect(link.status).toBe(200);
            expect(link.data.link).toMatch(/^https:\/\/t\.me\/dentflow_test_bot\?start=[\w-]{16}$/);
            const code = link.data.link.split('start=')[1];

            const forged = await webhook({ update_id: 1, message: { chat: { id: 555 }, text: `/start ${code}` } }, 'wrong');
            expect(forged.status).toBe(403);

            const before = sent('sendMessage').length;
            await webhook({ update_id: 2, message: { chat: { id: 555 }, text: `/start ${code}` } });
            await settle();
            expect(sent('sendMessage').slice(before)[0].body.text).toContain('Linky');
            expect((await t.api.get(`/reminders/patients/${p._id}`, recep.token)).data).toMatchObject({ telegramLinked: true, optOut: false });

            await webhook({ update_id: 3, message: { chat: { id: 777 }, text: `/start ${code}` } });
            await settle();
            const again = sent('sendMessage').at(-1)!;
            expect(again.body.chat_id).toBe('777');
            expect((await t.api.get(`/reminders/patients/${p._id}`, recep.token)).data.telegramLinked).toBe(true);

            // The link code is never in a patient read.
            expect(JSON.stringify((await t.api.get(`/patients/${p._id}`, recep.token)).body)).not.toContain(code);
        });

        it('/stop unlinks; staff can unlink too', async () => {
            const p = await t.addPatient(C.token, 'Stopper');
            await linkPatient(p, '600');
            await webhook({ update_id: 4, message: { chat: { id: 600 }, text: '/stop' } });
            await settle();
            expect((await t.api.get(`/reminders/patients/${p._id}`, recep.token)).data.telegramLinked).toBe(false);

            await linkPatient(p, '601');
            const r = await t.api.del(`/reminders/patients/${p._id}/telegram`, recep.token);
            expect(r.data.telegramLinked).toBe(false);
        });
    });

    describe('sending', () => {
        let viaTelegram: any, viaSms: any, optedOut: any, blocked: any, badNumber: any;
        let aTg: any, aSms: any, aOut: any, aBlocked: any, aBad: any, aLate: any;

        beforeAll(async () => {
            viaTelegram = await t.addPatient(C.token, 'Tg');
            viaSms = await t.addPatient(C.token, 'Sms');
            optedOut = await t.addPatient(C.token, 'Quiet');
            blocked = await t.addPatient(C.token, 'Blocker');
            badNumber = await t.addPatient(C.token, 'Wrong');
            await linkPatient(viaTelegram, '111');
            await linkPatient(blocked, 'blocked');
            await t.api.patch(`/reminders/patients/${optedOut._id}`, recep.token, { optOut: true });
            await t.api.patch(`/patients/${badNumber._id}`, C.token, { phone: '+37499000000' });

            aTg = await book(viaTelegram, '09:00');
            aSms = await book(viaSms, '09:30');
            aOut = await book(optedOut, '10:00');
            aBlocked = await book(blocked, '10:30');
            aBad = await book(badNumber, '11:00');
            aLate = await book(viaSms, '16:00');
            // Booked after the day-before reminder would have gone out.
            // Straight to the collection: Mongoose won't let createdAt be rewritten.
            await appointmentModel.collection.updateOne({ _id: new Types.ObjectId(aLate._id) }, { $set: { createdAt: local(dayBefore(day), '12:00') } });
        });

        it('nothing before the set time, nor at night', async () => {
            expect(await reminders.tick(local(dayBefore(day), '09:55'))).toEqual({ sent: 0, skipped: 0, failed: 0 });
            expect(await reminders.tick(local(dayBefore(day), '22:00'))).toEqual({ sent: 0, skipped: 0, failed: 0 });
        });

        it('the day before at 10:00: Telegram for linked patients, SMS otherwise, skips and failures logged', async () => {
            const before = fake.calls.length;
            const result = await reminders.tick(local(dayBefore(day), '10:05'));
            expect(result).toEqual({ sent: 3, skipped: 1, failed: 1 });
            const calls = fake.calls.slice(before);

            const tg = calls.find((c) => c.method === 'sendMessage' && c.body.chat_id === '111')!;
            expect(tg.body.text).toContain('Tg');
            expect(tg.body.text).toContain('09:00');
            expect(tg.body.reply_markup.inline_keyboard[0].map((b: any) => b.callback_data)).toEqual([`c:${aTg._id}`, `x:${aTg._id}`]);

            const [tgLog] = await logFor(aTg._id);
            expect(tgLog).toMatchObject({ rule: 'day_before', status: 'sent', channel: 'telegram' });
            expect((await logFor(aSms._id))[0]).toMatchObject({ status: 'sent', channel: 'sms' });
            expect((await logFor(aSms._id))[0].to).toMatch(/^\+3749.*•/);
            expect((await logFor(aOut._id))[0]).toMatchObject({ status: 'skipped', reason: 'optedOut' });
            expect((await logFor(aBad._id))[0]).toMatchObject({ status: 'failed', channel: 'sms' });
            expect((await logFor(aBad._id))[0].reason).toContain('not valid');
            expect(await logFor(aLate._id)).toHaveLength(0);
        });

        it('a patient who blocked the bot gets an SMS instead and is unlinked', async () => {
            expect((await logFor(aBlocked._id))[0]).toMatchObject({ status: 'sent', channel: 'sms' });
            expect((await t.api.get(`/reminders/patients/${blocked._id}`, recep.token)).data.telegramLinked).toBe(false);
        });

        it('later runs and parallel runs never send twice', async () => {
            const before = fake.calls.length;
            const [a, b] = await Promise.all([
                reminders.tick(local(dayBefore(day), '10:06')),
                reminders.tick(local(dayBefore(day), '10:06')),
            ]);
            expect(a.sent + b.sent).toBe(0);
            expect(await reminders.tick(local(dayBefore(day), '15:00'))).toEqual({ sent: 0, skipped: 0, failed: 0 });
            expect(fake.calls.length).toBe(before);
            expect(await logFor(aTg._id)).toHaveLength(1);
        });

        it('the clinic template is used, in the clinic language', async () => {
            await t.api.post('/settings/templates', C.token, {
                type: 'appointment_reminder',
                channel: 'sms',
                language: 'hy',
                bodyTemplate: 'Hello {{patient}}, see you at {{time}} on {{date}} ({{dentist}})',
            });
            const p = await t.addPatient(C.token, 'Templ');
            const next = at(6, 8).slice(0, 10);
            await book(p, '12:00', next);
            const before = fake.calls.length;
            await reminders.tick(local(dayBefore(next), '10:01'));
            const sms = fake.calls.slice(before).find((c) => c.service === 'twilio')!;
            expect(sms.body.Body).toBe(`Hello Templ ${p.lastName}, see you at 12:00 on ${next.slice(8, 10)}.${next.slice(5, 7)}.${next.slice(0, 4)} (Remi Staff)`);
        });

        it('two hours before, when switched on, for visits booked earlier', async () => {
            await t.call('PUT', '/reminders/settings', { token: C.token, body: { hoursBeforeEnabled: true, hoursBefore: 2 } });
            const p = await t.addPatient(C.token, 'Soon');
            const a = await book(p, '15:00');
            expect((await reminders.tick(local(day, '12:50'))).sent).toBe(0);
            const r = await reminders.tick(local(day, '13:05'));
            expect(r.sent).toBeGreaterThanOrEqual(1);
            expect((await logFor(a._id)).map((l: any) => l.rule)).toEqual(['hours_before']);
            await t.call('PUT', '/reminders/settings', { token: C.token, body: { hoursBeforeEnabled: false } });
        });
    });

    describe('answers from Telegram', () => {
        let patient: any, other: any;
        beforeAll(async () => {
            patient = await t.addPatient(C.token, 'Answer');
            other = await t.addPatient(C.token, 'Other');
            await linkPatient(patient, '222');
            await linkPatient(other, '333');
        });
        const press = (chatId: string, data: string) =>
            webhook({
                update_id: 9,
                callback_query: { id: `cq${Math.random()}`, from: { id: Number(chatId) }, data, message: { message_id: 5, chat: { id: chatId }, text: 'Reminder' } },
            });

        it('"I will come" confirms and the buttons go away', async () => {
            const a = await book(patient, '13:00');
            const before = fake.calls.length;
            await press('222', `c:${a._id}`);
            await settle();
            expect((await t.api.get(`/appointments/${a._id}`, C.token)).data.status).toBe('confirmed');
            const calls = fake.calls.slice(before).map((c) => c.method);
            expect(calls).toEqual(expect.arrayContaining(['answerCallbackQuery', 'editMessageText']));            // F7: logged as the patient's own action.
            const log = (await t.api.get(`/patients/${patient._id}/history?limit=1`, C.token)).data.items[0];
            expect(log).toMatchObject({
                event: 'appointments.patientConfirmed',
                actor: { kind: 'patient' },
                targetId: a._id,
                changes: [{ field: 'status', from: 'scheduled', to: 'confirmed' }],
            });
        });

        it('"I can\'t come" cancels with the reason and tells the front desk', async () => {
            const a = await book(patient, '14:00');
            await press('222', `x:${a._id}`);
            await settle();
            const after = (await t.api.get(`/appointments/${a._id}`, C.token)).data;
            expect(after.status).toBe('cancelled');
            expect(after.cancelReason).toBe('patient_request');
            expect(after.cancelNote).toBe('Telegram');
            const note = (await t.api.get('/notifications?limit=1', recep.token)).data.data[0];
            expect(note).toMatchObject({ type: 'appointment_cancelled', relatedId: a._id });            const log = (await t.api.get(`/patients/${patient._id}/history?limit=1`, C.token)).data.items[0];
            expect(log).toMatchObject({ event: 'appointments.patientCancelled', actor: { kind: 'patient' }, targetId: a._id });
        });

        it("another patient's chat cannot answer; nor after the visit is closed", async () => {
            const a = await book(patient, '16:30');
            await press('333', `x:${a._id}`);
            await settle();
            expect((await t.api.get(`/appointments/${a._id}`, C.token)).data.status).toBe('scheduled');
            expect(fake.calls.at(-1)!.method).toBe('answerCallbackQuery');

            await t.api.patch(`/appointments/${a._id}/cancel`, C.token, { reason: 'other' });
            await press('222', `c:${a._id}`);
            await settle();
            expect((await t.api.get(`/appointments/${a._id}`, C.token)).data.status).toBe('cancelled');
        });
    });

    describe('tenancy and tests', () => {
        it('another clinic cannot see or link this clinic\'s patients, and has its own settings', async () => {
            const p = await t.addPatient(C.token, 'Mine');
            const other = await t.registerClinic('OtherRemind');
            expect((await t.api.get(`/reminders/patients/${p._id}`, other.token)).status).toBe(404);
            expect((await t.api.post(`/reminders/patients/${p._id}/telegram-link`, other.token)).status).toBe(404);
            expect((await t.api.get('/reminders/settings', other.token)).data.telegram.connected).toBe(false);
        });

        it('an admin can send a test SMS to a patient; Telegram test needs a linked chat', async () => {
            const p = await t.addPatient(C.token, 'Testee');
            const sms = await t.api.post('/reminders/test', C.token, { channel: 'sms', patientId: p._id });
            expect(sms.status).toBe(200);
            expect(sms.data).toMatchObject({ sent: true, channel: 'sms' });
            const tg = await t.api.post('/reminders/test', C.token, { channel: 'telegram', patientId: p._id });
            expect(tg.status).toBe(400);
            expect(tg.body.code).toBe('reminderNoChannel');
        });
    });
});
