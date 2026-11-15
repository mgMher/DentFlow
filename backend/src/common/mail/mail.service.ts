import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export interface Mail {
    to: string;
    subject: string;
    text: string;
}

/**
 * Email for the whole app (F9), through SMTP set in the server environment:
 * SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for 465), SMTP_USER,
 * SMTP_PASSWORD, MAIL_FROM. Without SMTP_HOST, mail is written to the server
 * log instead; outside production the last messages are also kept in
 * `outbox` (tests read reset links from it).
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transport: Transporter | null | undefined;
    readonly outbox: (Mail & { at: Date })[] = [];

    get configured(): boolean {
        return !!process.env.SMTP_HOST;
    }

    async send(mail: Mail): Promise<void> {
        if (process.env.MODE !== 'PROD') {
            this.outbox.push({ ...mail, at: new Date() });
            if (this.outbox.length > 50) this.outbox.shift();
        }
        const transport = this.transportFor();
        if (!transport) {
            this.logger.log(`Email (no SMTP configured) to ${mail.to}: ${mail.subject}\n${mail.text}`);
            return;
        }
        await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: mail.to, subject: mail.subject, text: mail.text });
    }

    private transportFor(): Transporter | null {
        if (this.transport !== undefined) return this.transport;
        this.transport = this.configured
            ? createTransport({
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT) || 587,
                  secure: process.env.SMTP_SECURE === 'true',
                  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
              })
            : null;
        return this.transport;
    }
}
