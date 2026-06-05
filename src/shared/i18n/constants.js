/** Varsayılan dil — ilk açılışta Türkçe. */
export const DEFAULT_LOCALE = 'tr';

export const LOCALES = Object.freeze([
  { id: 'tr', native: 'Türkçe' },
  { id: 'en', native: 'English' },
  { id: 'fr', native: 'Français' },
  { id: 'de', native: 'Deutsch' },
  { id: 'zh', native: '中文' },
  { id: 'ja', native: '日本語' },
  { id: 'ko', native: '한국어' },
  { id: 'it', native: 'Italiano' },
  { id: 'ru', native: 'Русский' },
]);

export const LOCALE_IDS = new Set(LOCALES.map((l) => l.id));

export const HTML_LANG = Object.freeze({
  tr: 'tr',
  en: 'en',
  fr: 'fr',
  de: 'de',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  it: 'it',
  ru: 'ru',
});

export function normalizeLocale(locale) {
  const id = String(locale || DEFAULT_LOCALE).toLowerCase().split('-')[0];
  return LOCALE_IDS.has(id) ? id : DEFAULT_LOCALE;
}
