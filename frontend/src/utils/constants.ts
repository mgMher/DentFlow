export const DRAWER_WIDTH = 260;
export const DRAWER_WIDTH_COLLAPSED = 72;
export const HEADER_HEIGHT = 64;

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
    scheduled: '#3182CE',
    confirmed: '#38A169',
    in_progress: '#ED8936',
    completed: '#0B5E6E',
    cancelled: '#E53E3E',
    no_show: '#A0AEC0',
};

export const TOOTH_STATUS_COLORS: Record<string, string> = {
    healthy: '#38A169',
    filled: '#3182CE',
    crown: '#D69E2E',
    missing: '#A0AEC0',
    implant: '#805AD5',
    needs_treatment: '#E53E3E',
    root_canal: '#ED8936',
    decayed: '#C53030',
    bridge: '#2B6CB0',
    veneer: '#4FD1C5',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
    AMD: '֏',
    USD: '$',
    RUB: '₽',
};

export const TREATMENT_CATEGORIES = [
    'general', 'surgical', 'cosmetic', 'orthodontic',
    'endodontic', 'periodontic', 'prosthodontic',
    'pediatric', 'diagnostic', 'preventive',
] as const;

export const DAYS_OF_WEEK = [
    'sunday', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday',
] as const;

export const DEFAULT_PAGE_SIZE = 20;

export const LANGUAGES = [
    { code: 'hy', label: 'Հայerror', flag: '🇦🇲' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
] as const;
