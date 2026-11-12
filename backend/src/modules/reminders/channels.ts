/**
 * The two ways a reminder leaves the building. Each is a thin HTTP client;
 * the base URLs can be pointed at a local fake (`TELEGRAM_API_BASE`,
 * `TWILIO_API_BASE`) so tests exercise the real request code.
 */

export class ChannelError extends Error {
    constructor(
        message: string,
        /** HTTP status from the provider, e.g. 403 when a patient blocked the bot. */
        readonly status?: number,
    ) {
        super(message);
    }
}

const telegramBase = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
const twilioBase = () => (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/+$/, '');

export interface TelegramButton {
    text: string;
    callback_data: string;
}

export class TelegramBot {
    constructor(private readonly token: string) {}

    async call<T = any>(method: string, body: Record<string, unknown> = {}): Promise<T> {
        let res: Response;
        try {
            res = await fetch(`${telegramBase()}/bot${this.token}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10_000),
            });
        } catch (err) {
            throw new ChannelError(`Telegram unreachable: ${(err as Error).message}`);
        }
        const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
        if (!res.ok || !json?.ok) {
            throw new ChannelError(json?.description || `Telegram error ${res.status}`, res.status);
        }
        return json.result as T;
    }

    getMe() {
        return this.call<{ id: number; username: string }>('getMe');
    }

    sendMessage(chatId: string, text: string, buttons?: TelegramButton[][]) {
        return this.call<{ message_id: number }>('sendMessage', {
            chat_id: chatId,
            text,
            ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
        });
    }
}

export interface SmsSender {
    send(to: string, text: string): Promise<{ id: string }>;
}

export class TwilioSms implements SmsSender {
    constructor(
        private readonly accountSid: string,
        private readonly authToken: string,
        private readonly from: string,
    ) {}

    async send(to: string, text: string) {
        let res: Response;
        try {
            res = await fetch(`${twilioBase()}/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ To: to, From: this.from, Body: text }).toString(),
                signal: AbortSignal.timeout(10_000),
            });
        } catch (err) {
            throw new ChannelError(`Twilio unreachable: ${(err as Error).message}`);
        }
        const json = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
        if (!res.ok || !json?.sid) throw new ChannelError(json?.message || `Twilio error ${res.status}`, res.status);
        return { id: json.sid };
    }
}

/** "+374 77 •••• 33" style: enough to recognise, not enough to copy. */
export const maskPhone = (phone: string) =>
    phone.length > 6 ? `${phone.slice(0, 6)}${'•'.repeat(Math.max(0, phone.length - 8))}${phone.slice(-2)}` : phone;
