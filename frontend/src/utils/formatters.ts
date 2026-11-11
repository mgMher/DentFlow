import { format, parseISO, Locale } from 'date-fns';
import { hy, ru, enUS } from 'date-fns/locale';
import { CURRENCY_SYMBOLS } from './constants';

const localeMap: Record<string, Locale> = {
    hy,
    ru,
    en: enUS,
};

export const formatDate = (date: string | Date, pattern = 'dd.MM.yyyy', language = 'hy'): string => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, pattern, { locale: localeMap[language] || hy });
};

export const formatDateTime = (date: string | Date, language = 'hy'): string => {
    return formatDate(date, 'dd.MM.yyyy HH:mm', language);
};

export const formatTime = (date: string | Date): string => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'HH:mm');
};

export const formatCurrency = (amount: number, currency = 'AMD'): string => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);

    if (currency === 'USD') return `${symbol}${formatted}`;
    return `${formatted} ${symbol}`;
};

export const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

export const getFullName = (firstName: string, lastName: string, patronymic?: string): string => {
    const parts = [lastName, firstName];
    if (patronymic) parts.push(patronymic);
    return parts.filter(Boolean).join(' ');
};
