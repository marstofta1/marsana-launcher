'use strict';

const { LauncherError, Codes } = require('../infra/errors');

const BASE_URL = 'https://api.modrinth.com/v2';

function buildVersionQuery({ loaders, gameVersions }) {
  const q = new URLSearchParams();
  if (loaders) q.set('loaders', JSON.stringify(loaders));
  if (gameVersions) q.set('game_versions', JSON.stringify(gameVersions));
  return q.toString();
}

function primaryFile(files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  return files.find((f) => f.primary) || files[0];
}

function createModrinthClient({ httpClient }) {
  async function listProjectVersions(slug, { loaders, gameVersions } = {}) {
    const qs = buildVersionQuery({ loaders, gameVersions });
    const url = `${BASE_URL}/project/${encodeURIComponent(slug)}/version${qs ? `?${qs}` : ''}`;
    const arr = await httpClient.fetchJson(url);
    if (!Array.isArray(arr)) return [];
    return arr;
  }

  async function latestPrimaryFile(slug, opts) {
    const versions = await listProjectVersions(slug, opts);
    if (versions.length === 0) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Modrinth: "${slug}" için uygun sürüm bulunamadı.`
      );
    }
    const file = primaryFile(versions[0].files);
    if (!file) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, `Modrinth: ${slug} dosyası yok.`);
    }
    return { url: file.url, filename: file.filename };
  }

  async function latestVersion(slug, opts) {
    const versions = await listProjectVersions(slug, opts);
    if (versions.length === 0) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Modrinth: "${slug}" için uygun sürüm bulunamadı.`
      );
    }
    return versions[0];
  }

  async function versionById(versionId) {
    if (!versionId) return null;
    try {
      return await httpClient.fetchJson(`${BASE_URL}/version/${encodeURIComponent(versionId)}`);
    } catch {
      return null;
    }
  }

  function primaryFileOf(version) {
    return primaryFile(version && version.files);
  }

  return { listProjectVersions, latestPrimaryFile, latestVersion, versionById, primaryFileOf };
}

module.exports = { createModrinthClient };
