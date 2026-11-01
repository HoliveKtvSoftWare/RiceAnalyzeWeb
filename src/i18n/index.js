import { ref } from 'vue';
import enUS from './en-US.js';

const STORAGE_KEY = 'rice_analysis_locale';

export const SUPPORTED_LOCALES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];

const SUPPORTED_VALUES = SUPPORTED_LOCALES.map((item) => item.value);

function readStoredLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_VALUES.includes(saved)) return saved;
  } catch {
  }
  return 'zh-CN';
}

export const locale = ref(readStoredLocale());

const dictionaries = { 'en-US': enUS };

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole
  );
}

export function t(text, params) {
  if (text === null || text === undefined) return '';
  const dict = dictionaries[locale.value];
  const translated = (dict && dict[text]) || text;
  return interpolate(translated, params);
}

export function setLocale(next) {
  const value = SUPPORTED_VALUES.includes(next) ? next : 'zh-CN';
  locale.value = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value;
  }
}

export function useI18n() {
  return { t, locale, setLocale };
}

export default { t, locale, setLocale, useI18n };