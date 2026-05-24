'use strict';

const { LauncherError, Codes } = require('../infra/errors');

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function createVersionService({ httpClient, ttlMs = DEFAULT_TTL_MS } = {}) {
  let cache = null;
  let cachedAt = 0;

  async function fetchManifest() {
    return httpClient.fetchJson(MANIFEST_URL);
  }

  async function list() {
    const now = Date.now();
    if (cache && now - cachedAt < ttlMs) return cache;

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

  return { list, getVersionJson };
}

module.exports = { createVersionService };
