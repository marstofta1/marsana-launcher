import localeModules from '../../shared/i18n/locales/index.js';
import { createTranslator, buildMessagesRegistry } from '../../shared/i18n/translate.js';
import { LOCALES, HTML_LANG, DEFAULT_LOCALE } from '../../shared/i18n/constants.js';

const messagesByLocale = buildMessagesRegistry(localeModules);

/** index.html ve data-i18n öğelerini güncelle. */
export function applyStaticI18n(t) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const raw = el.getAttribute('data-i18n-attr') || '';
    for (const part of raw.split(';')) {
      const [attr, key] = part.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}

export function initI18n(store) {
  let current = createTranslator(messagesByLocale, store.getState().settings?.language || DEFAULT_LOCALE);
  const listeners = new Set();

  function applyDocumentLocale() {
    document.documentElement.lang = HTML_LANG[current.locale] || current.locale;
    applyStaticI18n(current.t);
  }

  function notify() {
    applyDocumentLocale();
    for (const fn of listeners) fn(current);
  }

  store.subscribe((state) => {
    const next = createTranslator(messagesByLocale, state.settings?.language || DEFAULT_LOCALE);
    if (next.locale !== current.locale) {
      current = next;
      notify();
    }
  });

  applyDocumentLocale();

  return {
    t: (key, params) => current.t(key, params),
    getLocale: () => current.locale,
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    LOCALES,
    DEFAULT_LOCALE,
  };
}

export { LOCALES, DEFAULT_LOCALE, HTML_LANG };
