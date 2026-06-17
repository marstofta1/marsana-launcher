'use strict';

const fs = require('fs');
const path = require('path');
const { LauncherError, Codes } = require('../infra/errors');

const MANIFEST_URLS = [
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json',
];
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DISK_CACHE_FILE = 'version-manifest-cache.json';

let bundledManifest = null;

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

function normalizeManifest(data) {
  return {
    latest: data.latest,
    versions: (data.versions || []).map((v) => ({
      id: v.id,
      type: v.type,
      releaseTime: v.releaseTime,
    })),
  };
}

function loadBundledFallback() {
  if (bundledManifest) return bundledManifest;
  try {
    bundledManifest = normalizeManifest(require('../../shared/bundledVersionManifest.json'));
    return bundledManifest;
  } catch {
    return null;
  }
}

function createVersionService({ httpClient, cacheDir, ttlMs = DEFAULT_TTL_MS } = {}) {
  let cache = null;
  let cachedAt = 0;
  const diskCachePath = cacheDir ? path.join(cacheDir, DISK_CACHE_FILE) : null;

  function readDiskCache() {
    if (!diskCachePath || !fs.existsSync(diskCachePath)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(diskCachePath, 'utf8'));
      if (!parsed || !Array.isArray(parsed.versions) || parsed.versions.length === 0) return null;
      return normalizeManifest(parsed);
    } catch {
      return null;
    }
  }

  function writeDiskCache(data) {
    if (!diskCachePath || !data) return;
    try {
      fs.mkdirSync(path.dirname(diskCachePath), { recursive: true });
      fs.writeFileSync(diskCachePath, JSON.stringify(data), 'utf8');
    } catch {
      /* ignore */
    }
  }

  async function fetchManifest() {
    return fetchFirstJson(httpClient, MANIFEST_URLS, 'Mojang sürüm listesi');
  }

  async function refreshFromNetwork() {
    const data = await fetchManifest();
    const normalized = normalizeManifest(data);
    cache = normalized;
    cachedAt = Date.now();
    writeDiskCache(normalized);
    return normalized;
  }

  async function list({ force = false } = {}) {
    const now = Date.now();
    if (!force && cache && now - cachedAt < ttlMs) return cache;

    const disk = readDiskCache();
    if (!force && disk) {
      cache = disk;
      cachedAt = now;
      void refreshFromNetwork().catch(() => {});
      return disk;
    }

    const bundled = loadBundledFallback();
    if (!force && bundled) {
      cache = bundled;
      cachedAt = now;
      void refreshFromNetwork()
        .then((fresh) => {
          cache = fresh;
          cachedAt = Date.now();
        })
        .catch(() => {});
      return bundled;
    }

    try {
      return await refreshFromNetwork();
    } catch (err) {
      if (disk) {
        cache = disk;
        cachedAt = now;
        return disk;
      }
      if (bundled) {
        cache = bundled;
        cachedAt = now;
        return bundled;
      }
      throw err;
    }
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
    if (diskCachePath && fs.existsSync(diskCachePath)) {
      try {
        fs.unlinkSync(diskCachePath);
      } catch {
        /* ignore */
      }
    }
  }

  return { list, getVersionJson, invalidateCache };
}

module.exports = { createVersionService, MANIFEST_URLS, fetchFirstJson, normalizeManifest };
