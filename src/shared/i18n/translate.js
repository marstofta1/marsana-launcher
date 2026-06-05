'use strict';

const { DEFAULT_LOCALE, normalizeLocale } = require('./constants');

function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function interpolate(template, params) {
  if (!params || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined && params[key] !== null ? String(params[key]) : `{${key}}`
  );
}

function createTranslator(messagesByLocale, locale) {
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

function buildMessagesRegistry(localeModules) {
  const messagesByLocale = {};
  for (const [id, mod] of Object.entries(localeModules)) {
    messagesByLocale[id] = mod.default || mod;
  }
  return messagesByLocale;
}

module.exports = {
  createTranslator,
  buildMessagesRegistry,
  getNested,
  DEFAULT_LOCALE,
  normalizeLocale,
};
