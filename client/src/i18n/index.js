import { createI18n } from 'vue-i18n';
import en from './en.js';
import ar from './ar.js';

const saved = localStorage.getItem('locale') || 'en';

const i18n = createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'en',
  messages: { en, ar },
});

export function applyLocale(locale) {
  i18n.global.locale.value = locale;
  localStorage.setItem('locale', locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

applyLocale(saved);

export default i18n;
