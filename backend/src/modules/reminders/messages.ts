/**
 * What patients read. A clinic's own "appointment reminder" SMS template (in
 * the clinic's language) replaces the default text; the bot's other replies
 * are fixed. Placeholders: {{patient}} {{date}} {{time}} {{dentist}} {{clinic}}
 * {{address}} {{phone}}.
 */

export type Lang = 'hy' | 'ru' | 'en';

export const REMINDER_PLACEHOLDERS = ['patient', 'date', 'time', 'dentist', 'clinic', 'address', 'phone'] as const;
export type ReminderVars = Record<(typeof REMINDER_PLACEHOLDERS)[number], string>;

const TEXT = {
    reminder: {
        en: 'Reminder: {{patient}}, you have an appointment at {{clinic}} on {{date}} at {{time}} with {{dentist}}. {{address}}',
        hy: 'Հիշեցում. {{patient}}, Դուք գրանցված եք {{clinic}}-ում {{date}}-ին, ժամը {{time}}-ին, բժիշկ՝ {{dentist}}։ {{address}}',
        ru: 'Напоминание: {{patient}}, вы записаны в {{clinic}} на {{date}} в {{time}}, врач — {{dentist}}. {{address}}',
    },
    confirm: { en: '✅ I will come', hy: '✅ Կգամ', ru: '✅ Приду' },
    cancel: { en: "❌ I can't come", hy: '❌ Չեմ կարող գալ', ru: '❌ Не смогу прийти' },
    confirmed: { en: '✅ Thank you, see you then!', hy: '✅ Շնորհակալություն, սպասում ենք Ձեզ։', ru: '✅ Спасибо, ждём вас!' },
    cancelled: {
        en: '❌ Your appointment is cancelled. Call {{phone}} to book another time.',
        hy: '❌ Ձեր այցը չեղարկված է։ Նոր ժամ ամրագրելու համար զանգահարեք {{phone}}։',
        ru: '❌ Ваш приём отменён. Чтобы записаться на другое время, позвоните {{phone}}.',
    },
    tooLate: {
        en: 'This appointment can no longer be changed here. Please call {{phone}}.',
        hy: 'Այս այցն այստեղ այլևս հնարավոր չէ փոխել։ Խնդրում ենք զանգահարել {{phone}}։',
        ru: 'Этот приём здесь уже нельзя изменить. Пожалуйста, позвоните {{phone}}.',
    },
    linked: {
        en: 'Hello, {{patient}}! You will get appointment reminders from {{clinic}} here. Send /stop to turn them off.',
        hy: 'Բարև, {{patient}}։ Այստեղ կստանաք {{clinic}}-ի այցերի հիշեցումները։ Անջատելու համար ուղարկեք /stop։',
        ru: 'Здравствуйте, {{patient}}! Здесь вы будете получать напоминания о приёмах в {{clinic}}. Чтобы отключить их, отправьте /stop.',
    },
    badLink: {
        en: 'This link is no longer valid. Please ask the clinic for a new one.',
        hy: 'Այս հղումն այլևս վավեր չէ։ Խնդրեք կլինիկայից նորը։',
        ru: 'Эта ссылка больше не действует. Попросите в клинике новую.',
    },
    stopped: {
        en: 'You will not get reminders here any more.',
        hy: 'Այստեղ այլևս հիշեցումներ չեք ստանա։',
        ru: 'Вы больше не будете получать здесь напоминания.',
    },
    linkSms: {
        en: '{{clinic}}: get appointment reminders in Telegram: {{link}}',
        hy: '{{clinic}}. ստացեք այցերի հիշեցումները Telegram-ով՝ {{link}}',
        ru: '{{clinic}}: получайте напоминания о приёмах в Telegram: {{link}}',
    },
    test: {
        en: 'Test message from {{clinic}}: reminders work.',
        hy: 'Փորձնական հաղորդագրություն {{clinic}}-ից․ հիշեցումներն աշխատում են։',
        ru: 'Тестовое сообщение от {{clinic}}: напоминания работают.',
    },
} as const;

export type MessageKey = keyof typeof TEXT;

export const langOf = (language?: string): Lang => (language === 'ru' || language === 'en' ? language : 'hy');

/** Fill `{{name}}` placeholders; unknown ones become empty. Extra spaces left behind are tidied. */
export const fill = (template: string, vars: Record<string, string | undefined>) =>
    template
        .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => vars[name] ?? '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

export const message = (key: MessageKey, lang: Lang, vars: Record<string, string | undefined> = {}) =>
    fill(TEXT[key][lang], vars);

/** `YYYY-MM-DD` → `dd.MM.yyyy`, the format patients in Armenia and Russia expect. */
export const displayDate = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
