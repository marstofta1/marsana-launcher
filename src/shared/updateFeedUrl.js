'use strict';

const DEFAULT_UPDATES_BASE_URL =
  'https://marstofta1.github.io/marsana-launcher/downloads';

const ALLOWED_UPDATE_HOSTS = Object.freeze(['marstofta1.github.io']);

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}

// Kabul edilirse ham metin değil, WHATWG'nin normalize ettiği adres döner:
// ters eğik çizgi, kontrol karakteri, %2e, tam genişlik harf, kullanıcı bilgisi
// ve fragment gibi numaralar setFeedURL'e hiç ulaşmaz. Uygun değilse null.
function sanitizeFeedUrl(candidate) {
  let parsed;
  try {
    parsed = new URL(String(candidate));
  } catch (err) {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.port !== '') return null;
  if (parsed.username || parsed.password) return null;
  if (!ALLOWED_UPDATE_HOSTS.includes(parsed.hostname.toLowerCase())) return null;
  return normalizeBaseUrl(`${parsed.origin}${parsed.pathname}`);
}

function isAllowedFeedUrl(candidate) {
  return sanitizeFeedUrl(candidate) !== null;
}

// Güncelleme paketi imzasız kuruluyor, bu yüzden tek güven noktası adresin
// kendisi: yalnızca izinli host'tan https ile gelen besleme kabul edilir.
// Ortam değişkeni başka bir hedef gösterirse sessizce sabit varsayılana dönülür.
function resolveFeedUrl(envValue) {
  const raw = typeof envValue === 'string' ? envValue.trim() : '';
  if (!raw) return DEFAULT_UPDATES_BASE_URL;
  return sanitizeFeedUrl(raw) || DEFAULT_UPDATES_BASE_URL;
}

module.exports = {
  DEFAULT_UPDATES_BASE_URL,
  ALLOWED_UPDATE_HOSTS,
  normalizeBaseUrl,
  sanitizeFeedUrl,
  isAllowedFeedUrl,
  resolveFeedUrl,
};
