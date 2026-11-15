/** The password-reset email (F9), in the clinic's language. */
type Lang = 'hy' | 'ru' | 'en';

const TEXT: Record<Lang, { subject: string; body: (name: string, clinic: string, link: string, minutes: number) => string }> = {
    hy: {
        subject: 'DentFlow — գաղտնաբառի վերականգնում',
        body: (name, clinic, link, minutes) =>
            `Բարև ${name},\n\nԳաղտնաբառը վերականգնելու հայտ է ստացվել ձեր DentFlow հաշվի համար (${clinic})։ Նոր գաղտնաբառ սահմանելու համար բացեք հղումը.\n\n${link}\n\nՀղումը գործում է ${minutes} րոպե և միայն մեկ անգամ։ Եթե հայտը դուք չեք ուղարկել, պարզապես անտեսեք այս նամակը։ Ձեր գաղտնաբառը չի փոխվի։`,
    },
    ru: {
        subject: 'DentFlow — восстановление пароля',
        body: (name, clinic, link, minutes) =>
            `Здравствуйте, ${name}!\n\nМы получили запрос на восстановление пароля к вашей учётной записи DentFlow (${clinic}). Чтобы задать новый пароль, откройте ссылку:\n\n${link}\n\nСсылка действует ${minutes} минут и только один раз. Если вы не запрашивали восстановление, просто проигнорируйте это письмо — пароль не изменится.`,
    },
    en: {
        subject: 'DentFlow — reset your password',
        body: (name, clinic, link, minutes) =>
            `Hello ${name},\n\nWe received a request to reset the password of your DentFlow account (${clinic}). To choose a new password, open this link:\n\n${link}\n\nThe link works for ${minutes} minutes and only once. If you didn't ask for this, ignore this email — your password stays the same.`,
    },
};

export const resetEmail = (language: string | undefined, name: string, clinic: string, link: string, minutes: number) => {
    const t = TEXT[(['hy', 'ru', 'en'].includes(language ?? '') ? language : 'hy') as Lang];
    return { subject: t.subject, text: t.body(name, clinic, link, minutes) };
};
