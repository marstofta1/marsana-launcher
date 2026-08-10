'use strict';

// O4 — shaderStackService'ten çıkarılan Modrinth sürüm-seçim mantığı.
// Yan etkisiz, elektron-bağımsız (yalnızca modCompatibilityService'e dayanır),
// bu yüzden `node --test` altında doğrudan test edilebilir. shaderStackService
// bu fonksiyonları require eder ve testler için aynı adlarla yeniden dışa aktarır.
// Davranış shaderStackService'teki orijinaliyle BİREBİR aynıdır.

const modCompatibilityService = require('./modCompatibilityService');

function extractMcVersionFromModMeta(version) {
  if (!version) return null;
  const file = (version.files && version.files[0]) || {};
  const haystack = `${file.filename || ''} ${version.name || ''} ${version.version_number || ''}`;
  const m = haystack.match(/mc(\d+\.\d+(?:\.\d+)?)/i);
  return m ? m[1] : null;
}

// 26.1.2 gibi patch sürümlerde Modrinth bazen mc26.1.1 jar'ını da listeler;
// NeoForge API değişince NoSuchMethodError ile dünya yüklenirken crash olur.
function versionMatchesGamePatch(version, gameVersion) {
  const gvs = version && version.game_versions;
  if (!Array.isArray(gvs) || !gvs.includes(gameVersion)) return false;
  if (!/^\d+\.\d+\.\d+$/.test(String(gameVersion))) return true;
  if (/^26\./.test(String(gameVersion))) {
    if (!versionListsAnyGame(version, modrinthLoaderModGameVersionCandidates(gameVersion))) {
      return false;
    }
    const tagged = extractMcVersionFromModMeta(version);
    if (tagged && /^26\./.test(tagged)) {
      return modCompatibilityService.mc26VersionsCompatible(tagged, gameVersion);
    }
    return true;
  }
  const tagged = extractMcVersionFromModMeta(version);
  if (!tagged) return true;
  return tagged === gameVersion;
}

// 26.x loader modları için yalnızca gerçek 26.x etiketleri — 1.21.x fallback
// jar'ları Fabric'te "wrong version is present" hatası verir (Polytone vb.).
function modrinthLoaderModGameVersionCandidates(gameVersion) {
  const id = String(gameVersion || '').trim();
  const candidates = [id];
  const m26 = id.match(/^26\.(\d+)(?:\.(\d+))?$/);
  if (m26) {
    if (m26[2]) candidates.push(`26.${m26[1]}`);
    return [...new Set(candidates)];
  }
  const baseTwo = id.match(/^1\.(\d+)$/);
  if (baseTwo) candidates.push(`${id}.1`);
  const classicPatch = id.match(/^(\d+\.\d+)\.\d+$/);
  if (classicPatch) candidates.push(classicPatch[1]);
  return [...new Set(candidates)];
}

// 26.x sürümlerde Modrinth listesi gecikebilir (kaynak paketleri için 1.21.x fallback).
function modrinthClassicFallbacksForGameVersion(gameVersion) {
  const id = String(gameVersion || '').trim();
  const m26 = id.match(/^26\.(\d+)(?:\.\d+)?$/);
  if (!m26) return [];
  const minor = parseInt(m26[1], 10);
  if (minor <= 1) return ['1.21.11', '1.21.10', '1.21.9'];
  if (minor === 2) return ['1.22.0', '1.22.1'];
  return [];
}

function modrinthGameVersionCandidates(gameVersion) {
  const id = String(gameVersion || '').trim();
  const candidates = [id];
  const m26 = id.match(/^26\.(\d+)(?:\.(\d+))?$/);
  if (m26) {
    if (m26[2]) candidates.push(`26.${m26[1]}`);
    candidates.push(...modrinthClassicFallbacksForGameVersion(id));
    return [...new Set(candidates)];
  }
  const baseTwo = id.match(/^1\.(\d+)$/);
  if (baseTwo) candidates.push(`${id}.1`);
  const classicPatch = id.match(/^(\d+\.\d+)\.\d+$/);
  if (classicPatch && !m26) candidates.push(classicPatch[1]);
  return [...new Set(candidates)];
}

function versionListsAnyGame(version, candidates) {
  const gvs = version && version.game_versions;
  if (!Array.isArray(gvs)) return false;
  return candidates.some((gv) => gvs.includes(gv));
}

function modrinthCandidateRank(version, candidates) {
  const gvs = version && version.game_versions;
  if (!Array.isArray(gvs)) return Infinity;
  for (let i = 0; i < candidates.length; i++) {
    if (gvs.includes(candidates[i])) return i;
  }
  return Infinity;
}

function versionMatchesLoaderModGame(version, gameVersion) {
  return versionListsAnyGame(version, modrinthLoaderModGameVersionCandidates(gameVersion));
}

function versionMatchesGameForFetch(version, gameVersion, { strictPatch = false } = {}) {
  if (strictPatch) return versionMatchesGamePatch(version, gameVersion);
  return versionListsAnyGame(version, modrinthGameVersionCandidates(gameVersion));
}

function pickNewestModrinthVersion(versions, { anchorTs, strictPatch = false, gameVersion, gameVersionCandidates } = {}) {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  const candidates = gameVersionCandidates || modrinthGameVersionCandidates(gameVersion);
  let eligible = versions.filter((v) =>
    strictPatch
      ? versionMatchesGamePatch(v, gameVersion)
      : versionListsAnyGame(v, candidates)
  );
  if (eligible.length === 0) return null;

  const ts = typeof anchorTs === 'number' ? anchorTs : Date.now();
  const sortByRankAndDate = (a, b) => {
    const cr = modrinthCandidateRank(a, candidates) - modrinthCandidateRank(b, candidates);
    if (cr !== 0) return cr;
    const releaseRank = (v) => (v.version_type === 'release' ? 0 : 1);
    const dr = releaseRank(a) - releaseRank(b);
    if (dr !== 0) return dr;
    return Date.parse(b.date_published || '') - Date.parse(a.date_published || '');
  };
  const dated = eligible
    .filter((v) => !v.date_published || Date.parse(v.date_published) <= ts)
    .sort(sortByRankAndDate);
  if (dated.length > 0) return dated[0];
  return eligible.sort(sortByRankAndDate)[0];
}

function expandResourcePackGameVersions(gameVersion) {
  return modrinthGameVersionCandidates(gameVersion);
}

function versionListsGame(versionGameVersions, gameVersion) {
  const gvs = versionGameVersions || [];
  const candidates = modrinthGameVersionCandidates(gameVersion);
  return candidates.some((gv) => gvs.includes(gv));
}

function glowingOresVariantLabel(version) {
  const hay = `${version.name || ''} ${version.version_number || ''} ${(version.files && version.files[0] && version.files[0].filename) || ''}`.toLowerCase();
  if (hay.includes('border') || hay.includes('[bv') || hay.includes('bv-')) return 'border';
  if (hay.includes('default') || hay.includes('[dv') || hay.includes('dv-')) return 'default';
  return 'unknown';
}

function pickGlowingOresVersion(versions, { gameVersion, wantBorder }) {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  const candidates = modrinthGameVersionCandidates(gameVersion);
  const eligible = versions.filter((v) => versionListsAnyGame(v, candidates));
  if (eligible.length === 0) return null;

  const preferred = wantBorder ? 'border' : 'default';
  let pool = eligible.filter((v) => glowingOresVariantLabel(v) === preferred);
  if (pool.length === 0 && !wantBorder) {
    pool = eligible.filter((v) => glowingOresVariantLabel(v) !== 'border');
  }
  if (pool.length === 0) pool = eligible;

  pool.sort((a, b) => {
    const cr = modrinthCandidateRank(a, candidates) - modrinthCandidateRank(b, candidates);
    if (cr !== 0) return cr;
    return Date.parse(b.date_published || '') - Date.parse(a.date_published || '');
  });
  return pool[0] || null;
}

module.exports = {
  extractMcVersionFromModMeta,
  versionMatchesGamePatch,
  modrinthLoaderModGameVersionCandidates,
  modrinthClassicFallbacksForGameVersion,
  modrinthGameVersionCandidates,
  versionListsAnyGame,
  modrinthCandidateRank,
  versionMatchesLoaderModGame,
  versionMatchesGameForFetch,
  pickNewestModrinthVersion,
  expandResourcePackGameVersions,
  versionListsGame,
  glowingOresVariantLabel,
  pickGlowingOresVersion,
};
