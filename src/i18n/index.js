/**
 * 极简 i18n：中文原文就是 key。
 *
 * 设计取舍：
 * - 不引入 vue-i18n：本项目只有中/英两种语言，且中文文案已经写死在模板里，
 *   用「中文原文 → 英文」的字典可以逐文件增量翻译，不翻译的句子自动保持中文，
 *   不会出现 key 泄漏或空白。
 * - t() 在渲染时读取 locale.value，模板/computed 会自然建立依赖，
 *   切换语言后已挂载的页面立即重渲染，不需要刷新。
 * - 插值用 {name} 占位：t('共 {n} 个文件', { n: 3 })。
 */
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
    /* localStorage 不可用（隐私模式等）时按默认语言 */
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

/**
 * 翻译：中文原文进，当前语言出。
 * @param {string} text 中文原文（同时作为字典 key）
 * @param {Record<string, unknown>} [params] 插值参数
 */
export function t(text, params) {
  if (text === null || text === undefined) return '';
  const dict = dictionaries[locale.value];
  const translated = (dict && dict[text]) || text;
  return interpolate(translated, params);
}

/** 切换语言：写 localStorage、同步 <html lang>，并触发依赖 locale 的组件重渲染。 */
export function setLocale(next) {
  const value = SUPPORTED_VALUES.includes(next) ? next : 'zh-CN';
  locale.value = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* 存不了就只在本次会话生效 */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value;
  }
}

/** 组件内使用：const { t, locale, setLocale } = useI18n() */
export function useI18n() {
  return { t, locale, setLocale };
}

export default { t, locale, setLocale, useI18n };
