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

// Modrinth her dosyaya sha512+sha1 ve boyut verir; bunları httpClient.download'ın
// beklediği { sha512, sha1, size } biçimine çevirir. httpClient "varsa doğrula"
// uyguladığı için eksik alanlar sorun değil. sha512 tercih edilir (daha güçlü),
// ama ikisi de verilirse ikisi de doğrulanır.
function fileIntegrity(file) {
  const h = (file && file.hashes) || {};
  const out = {};
  if (h.sha512) out.sha512 = h.sha512;
  if (h.sha1) out.sha1 = h.sha1;
  if (file && Number.isFinite(file.size)) out.size = file.size;
  return out;
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
    const sorted = versions.slice().sort((a, b) => {
      const releaseRank = (v) => (v.version_type === 'release' ? 0 : 1);
      const dr = releaseRank(a) - releaseRank(b);
      if (dr !== 0) return dr;
      return Date.parse(b.date_published || '') - Date.parse(a.date_published || '');
    });
    const file = primaryFile(sorted[0].files);
    if (!file) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, `Modrinth: ${slug} dosyası yok.`);
    }
    // hashes/size'ı da taşı ki indirme bütünlüğü doğrulanabilsin (eskiden
    // düşürülüyordu). fileIntegrity(file) hem bu sonuç hem de primaryFileOf
    // için aynı şekilde çalışır.
    return {
      url: file.url,
      filename: file.filename,
      hashes: file.hashes,
      size: file.size,
      version: sorted[0],
    };
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

  return { listProjectVersions, latestPrimaryFile, latestVersion, versionById, primaryFileOf, fileIntegrity };
}

module.exports = { createModrinthClient };
