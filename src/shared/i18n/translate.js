import { DEFAULT_LOCALE, normalizeLocale } from './constants.js';

export function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

export function interpolate(template, params) {
  if (!params || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined && params[key] !== null ? String(params[key]) : `{${key}}`
  );
}

export function createTranslator(messagesByLocale, locale) {
  const id = normalizeLocale(locale);
  const primary = messagesByLocale[id] || {};
  const fallbackEn = messagesByLocale.en || {};
  const fallbackTr = messagesByLocale.tr || {};

  function t(key, params) {
    const raw =
      getNested(primary, key) ??
      getNested(fallbackEn, key) ??
      getNested(fallbackTr, key) ??
      key;
    return interpolate(raw, params);
  }

  return { locale: id, t };
}

export function buildMessagesRegistry(localeModules) {
  const messagesByLocale = {};
  for (const [id, mod] of Object.entries(localeModules)) {
    messagesByLocale[id] = mod?.default ?? mod;
  }
  return messagesByLocale;
}

export { DEFAULT_LOCALE, normalizeLocale };
