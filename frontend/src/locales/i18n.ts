import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import hy from './hy/translation.json';
import ru from './ru/translation.json';
import en from './en/translation.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            hy: { translation: hy },
            ru: { translation: ru },
            en: { translation: en },
        },
        fallbackLng: 'hy',
        lng: localStorage.getItem('language') || 'hy',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'language',
        },
    });

export default i18n;
