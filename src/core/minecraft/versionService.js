'use strict';

const { LauncherError, Codes } = require('../infra/errors');

const MANIFEST_URLS = [
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
];
const DEFAULT_TTL_MS = 10 * 60 * 1000;

async function fetchFirstJson(httpClient, urls, label) {
  const errors = [];
  for (const url of urls) {
    try {
      return await httpClient.fetchJson(url);
    } catch (err) {
      errors.push(`${url} → ${err?.message || err}`);
    }
  }
  const enotfound = errors.some((line) => /ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(line));
  const hint = enotfound
    ? ' Internet/DNS sorunu olabilir: baglantiyi kontrol edin, DNS olarak 1.1.1.1 veya 8.8.8.8 deneyin, VPN/firewall/antivirusu gecici kapatın.'
    : '';
  throw new LauncherError(
    Codes.NETWORK,
    `${label} alınamadı.${hint} (${errors.join(' | ')})`,
    errors
  );
}

function createVersionService({ httpClient, ttlMs = DEFAULT_TTL_MS } = {}) {
  let cache = null;
  let cachedAt = 0;

  async function fetchManifest() {
    return fetchFirstJson(httpClient, MANIFEST_URLS, 'Mojang sürüm listesi');
  }

  async function list({ force = false } = {}) {
    const now = Date.now();
    if (!force && cache && now - cachedAt < ttlMs) return cache;

    const data = await fetchManifest();
    cache = {
      latest: data.latest,
      versions: data.versions.map((v) => ({
        id: v.id,
        type: v.type,
        releaseTime: v.releaseTime,
      })),
    };
    cachedAt = now;
    return cache;
  }

  async function getVersionJson(versionId) {
    const data = await fetchManifest();
    const entry = data.versions.find((v) => v.id === versionId);
    if (!entry) {
      throw new LauncherError(
        Codes.VERSION_NOT_FOUND,
        `Mojang sürüm listesinde "${versionId}" bulunamadı.`
      );
    }
    return httpClient.fetchJson(entry.url);
  }

  function invalidateCache() {
    cache = null;
    cachedAt = 0;
  }

  return { list, getVersionJson, invalidateCache };
}

module.exports = { createVersionService, MANIFEST_URLS, fetchFirstJson };
