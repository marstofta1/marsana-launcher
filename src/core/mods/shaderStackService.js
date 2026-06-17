'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');

const { LauncherError, Codes } = require('../infra/errors');
const marsanaClientModService = require('./marsanaClientModService');
const modIsolationService = require('./modIsolationService');
const hudDepsService = require('./hudDepsService');
const modCompatibilityService = require('./modCompatibilityService');
const { CLIENT_HUD_MOD_SLUGS, CLIENT_HUD_REQUIRED_SLUGS } = require('../../shared/clientHudModRegistry');

const BUNDLE_FILE = '.marsana-mod-bundle.json';
const READY_FILE = '.marsana-shader-ready.json';
const SHADER_BUNDLE_VERSION = 46;

// Anchor mod'ları önce yazıyoruz; dependency çözümlemesi onlardan başlar,
// böylece Iris/Continuity istedikleri Sodium sürümünü kilitler.
const SHADER_FPS_SLUGS = Object.freeze(['iris', 'sodium', 'fabric-api']);
const EMBOSSED_SLUGS = Object.freeze(['continuity', 'sodium', 'fabric-api']);
const VOICE_CHAT_SLUG = 'simple-voice-chat';
const FULLBRIGHT_UB_SLUG = 'fullbright-ub';
const POLYTONE_SLUG = 'polytone';
const FULLBRIGHT_PACK_LOCAL_NAME = 'fullbright-ub.zip';
const BETTER_LEAVES_SLUG = 'better-leaves';
const BETTER_LEAVES_PACK_LOCAL_NAME = 'better-leaves.zip';
const CULL_LEAVES_SLUG = 'cull-leaves';
const GLOWING_ORES_SLUG = 'new-glowing-ores';
const GLOWING_ORES_PACK_LOCAL_NAME = 'new-glowing-ores.zip';
const ROUND_TREES_SLUG = 'round-trees';
const ROUND_TREES_PACK_LOCAL_NAME = 'round-trees.zip';
const CROPS_3D_SLUG = '3d-crops';
const CROPS_3D_PACK_LOCAL_NAME = '3d-crops.zip';
const CONTINUITY_SLUG = 'continuity';
const DEFAULT_SHADER_SLUG = 'complementary-reimagined';
const OPTIFINE_PROJECT = 'optifine-for-fabric';

// UI'dan gelen shader slug'ını kabul edilen değerlere kıs — geçersiz/eski bir
// slug Modrinth'te 404'e dönüp tüm launch'u patlatabilir. Tanınmayan slug
// için sessizce default'a düş.
const KNOWN_SHADER_SLUGS = new Set([
  'complementary-reimagined', 'complementary-unbound', 'bsl-shaders',
  'photon-shader', 'solas-shader', 'bliss-shader', 'rethinking-voxels',
  'makeup-ultra-fast-shaders', 'potato-shaders', 'super-duper-vanilla', 'insanity-shader',
  'pastel-shaders', 'mellow', 'astralex', 'nostalgia-shader',
  'miniature-shader', 'vanillaa', 'hysteria-shaders', 'kappa-shader',
  'spooklementary',
]);

function resolveShaderSlug(requested) {
  if (typeof requested === 'string' && KNOWN_SHADER_SLUGS.has(requested)) return requested;
  return DEFAULT_SHADER_SLUG;
}

// Modrinth dosya adları (AstraLex vb.) § kodları içerebiliyor. Yerel diskte
// her zaman slug.zip kullan — Iris eşleşmesi ve önbellek tutarlı kalır.
function shaderPackLocalName(slug) {
  return `${resolveShaderSlug(slug)}.zip`;
}

function isModrinthNotFound(err) {
  return err instanceof LauncherError && err.code === Codes.MODRINTH_NOT_FOUND;
}

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
  const baseTwo = id.match(/^(\d+\.\d+)$/);
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
  }
  const baseTwo = id.match(/^(\d+\.\d+)$/);
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

// Modrinth'te en yeni sürüm "Border" (yalnızca Continuity); OptiFine yolu "Default" ister.
// 1.21.9+ ve 26.x: pack.mcmeta min_format/max_format zorunlu; Modrinth paketleri
// eski pack_format + supported_formats ile gelince oyun başlangıçta paketi siliyor.
function resourcePackFormatForGameVersion(gameVersion) {
  const id = String(gameVersion || '').trim();
  const m26 = id.match(/^26\.(\d+)(?:\.(\d+))?$/);
  if (m26) {
    const minor = parseInt(m26[1], 10);
    if (minor <= 1) return 84;
    if (minor === 2) return 88;
    return 84 + (minor - 1) * 4;
  }
  const m121 = id.match(/^1\.21(?:\.(\d+))?$/);
  if (m121) {
    const patch = m121[1] ? parseInt(m121[1], 10) : 0;
    if (patch <= 1) return 34;
    if (patch === 2 || patch === 3) return 42;
    if (patch === 4) return 46;
    if (patch === 5) return 55;
    if (patch === 6 || patch === 7) return 63;
    if (patch === 8) return 64;
    if (patch === 9 || patch === 10) return 69;
    if (patch === 11) return 75;
    return 69;
  }
  if (/^1\.22/.test(id)) return 88;
  return null;
}

function gameUsesModernResourcePackFormat(gameVersion) {
  const fmt = resourcePackFormatForGameVersion(gameVersion);
  return fmt != null && fmt >= 65;
}

function packFormatScalar(fmt) {
  if (fmt == null) return null;
  if (Array.isArray(fmt)) return fmt[0];
  return fmt;
}

function packAlreadySupportsGameFormat(pack, format) {
  const min = packFormatScalar(pack.min_format);
  const max = packFormatScalar(pack.max_format);
  if (min == null || max == null) return false;
  // 1.21.9+ oyunları geniş min/max aralığını (ör. 55–84) reddedip options.txt'ten
  // silebiliyor; hedef sürümle birebir eşleşme gerekir.
  return (
    min === format &&
    max === format &&
    pack.pack_format == null &&
    pack.supported_formats == null
  );
}

function patchResourcePackZipForGameVersion(zipPath, gameVersion) {
  if (!gameUsesModernResourcePackFormat(gameVersion)) return false;
  const format = resourcePackFormatForGameVersion(gameVersion);
  if (format == null || !fs.existsSync(zipPath)) return false;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('pack.mcmeta');
  if (!entry) return false;

  let meta;
  try {
    meta = JSON.parse(entry.getData().toString('utf8'));
  } catch {
    return false;
  }

  const pack = meta.pack || {};
  if (packAlreadySupportsGameFormat(pack, format)) return false;

  const description = pack.description != null ? pack.description : 'Resource pack';
  meta.pack = { description, min_format: format, max_format: format };

  // adm-zip writeZip() mevcut arşivi yerinde güncellerken bazı paketleri (3D crops vb.)
  // bozabiliyor; çıkar → pack.mcmeta yaz → yeniden zip'le akışı güvenli.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-rp-'));
  const tmpOut = `${zipPath}.marsana-patch.tmp`;
  try {
    zip.extractAllTo(tmpRoot, true);
    fs.writeFileSync(path.join(tmpRoot, 'pack.mcmeta'), `${JSON.stringify(meta, null, 3)}\n`, 'utf8');
    const newZip = new AdmZip();
    newZip.addLocalFolder(tmpRoot);
    newZip.writeZip(tmpOut);
    fs.renameSync(tmpOut, zipPath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch {
      /* ignore */
    }
    return false;
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion }) {
  if (!localName || !resourcepacksDir) return;
  patchResourcePackZipForGameVersion(path.join(resourcepacksDir, localName), gameVersion);
}

function customIdFor(gameVersion, presets, shaderSlug, { loaderPrefix = 'marsana' } = {}) {
  if (presets.optifine) return `${loaderPrefix}-optifine-${gameVersion}`;
  if (presets.shaderFps && shaderSlug && KNOWN_SHADER_SLUGS.has(shaderSlug)) {
    return `${loaderPrefix}-shader-${gameVersion}-${shaderSlug}`;
  }
  if (presets.voiceChat && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d) {
    return `${loaderPrefix}-voice-${gameVersion}`;
  }
  if (presets.fullbrightUb && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d) {
    return `${loaderPrefix}-fullbright-${gameVersion}`;
  }
  if (presets.betterLeaves && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.glowingOres && !presets.roundTrees && !presets.crops3d) {
    return `${loaderPrefix}-betterleaves-${gameVersion}`;
  }
  if (presets.glowingOres && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.roundTrees && !presets.crops3d) {
    return `${loaderPrefix}-glowingores-${gameVersion}`;
  }
  if (presets.roundTrees && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.crops3d) {
    return `${loaderPrefix}-roundtrees-${gameVersion}`;
  }
  if (presets.crops3d && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees) {
    return `${loaderPrefix}-crops3d-${gameVersion}`;
  }
  if (presets.shaderFps || presets.embossedBlocks || presets.voiceChat || presets.fullbrightUb || presets.betterLeaves || presets.glowingOres || presets.roundTrees || presets.crops3d) {
    return `${loaderPrefix}-shader-${gameVersion}`;
  }
  return `${loaderPrefix}-shader-${gameVersion}`;
}

function cleanupStaleShaderPacks(shaderpacksDir, activeSlug) {
  if (!fs.existsSync(shaderpacksDir)) return;
  const keepName = shaderPackLocalName(activeSlug);
  for (const entry of fs.readdirSync(shaderpacksDir)) {
    if (!entry.toLowerCase().endsWith('.zip')) continue;
    if (entry === keepName) continue;
    const lower = entry.toLowerCase();
    const isKnown = [...KNOWN_SHADER_SLUGS].some((s) => lower === `${s}.zip`);
    if (isKnown || /§|Â§/.test(entry)) {
      removeIfExists(path.join(shaderpacksDir, entry));
    }
  }
}

function isCorruptShaderPackName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  return /§|Â§|\u00C2\u00A7|\\u00C2\\u00A7|LexBoosT/i.test(s);
}

function repairLegacyShaderPack({ gameRoot, shaderpacksDir, shaderSlug, activateFns }) {
  const slug = resolveShaderSlug(shaderSlug);
  const targetName = shaderPackLocalName(slug);
  const targetPath = path.join(shaderpacksDir, targetName);

  if (fs.existsSync(shaderpacksDir) && !fs.existsSync(targetPath)) {
    for (const entry of fs.readdirSync(shaderpacksDir)) {
      if (!entry.toLowerCase().endsWith('.zip')) continue;
      if (entry === targetName) continue;
      const lower = entry.toLowerCase();
      const slugHint = slug.replace(/-/g, '');
      if (
        isCorruptShaderPackName(entry) ||
        lower.includes(slugHint) ||
        (slug === 'astralex' && /astra|lexboost/i.test(lower))
      ) {
        fs.renameSync(path.join(shaderpacksDir, entry), targetPath);
        break;
      }
    }
  }

  for (const activate of activateFns) {
    activate({ gameRoot, shaderpackFilename: targetName });
  }

  const modsDir = path.join(gameRoot, 'mods');
  const bundle = readBundle(modsDir);
  if (!bundle) return targetName;
  const current = (bundle.shaderpacks || [])[0];
  if (current !== targetName || isCorruptShaderPackName(current)) {
    writeBundle(modsDir, {
      ...bundle,
      shaderSlug: slug,
      shaderpacks: fs.existsSync(targetPath) ? [targetName] : bundle.shaderpacks,
      updatedAt: Date.now(),
    });
  }
  return targetName;
}

function normalizePresets(p) {
  return {
    shaderFps: !!(p && p.shaderFps),
    embossedBlocks: !!(p && p.embossedBlocks),
    optifine: !!(p && p.optifine),
    voiceChat: !!(p && p.voiceChat),
    fullbrightUb: !!(p && p.fullbrightUb),
    betterLeaves: !!(p && p.betterLeaves),
    glowingOres: !!(p && p.glowingOres),
    roundTrees: !!(p && p.roundTrees),
    crops3d: !!(p && p.crops3d),
    marsanaClientMenu: !!(p && p.marsanaClientMenu),
    clientHudPack: !!(p && p.clientHudPack),
  };
}

const STRICT_PATCH_MOD_SLUGS = new Set([
  ...CLIENT_HUD_REQUIRED_SLUGS,
  'sodium-extra',
  'iris',
  'sodium',
]);

const OPTIONAL_LOADER_MOD_SLUGS = new Set([POLYTONE_SLUG, ...CLIENT_HUD_MOD_SLUGS]);

function usesStrictModrinthPatch(gameVersion) {
  const id = String(gameVersion || '').trim();
  return /^\d+\.\d+\.\d+$/.test(id) && !/^26\./.test(id);
}

function polytoneSupportedForGameVersion(gameVersion) {
  // Polytone Modrinth'te en fazla 1.21.11'e kadar; 26.x için native jar yok.
  return !/^26\./.test(String(gameVersion || '').trim());
}

function fullbrightNeedsPolytone(p, gameVersion) {
  return !!(
    p.fullbrightUb &&
    p.shaderFps &&
    !p.optifine &&
    polytoneSupportedForGameVersion(gameVersion)
  );
}

function betterLeavesNeedsCullLeaves(p) {
  // Better Leaves kaynak paketi tek başına yetmez; Cull Leaves (veya OptiFine Smart Leaves) gerekir.
  return !!(p.betterLeaves && !p.optifine);
}

function glowingOresNeedsContinuity(p) {
  return !!(p.glowingOres && !p.optifine && !p.embossedBlocks);
}

function modrinthSlugsForPresets(p, gameVersion) {
  if (p.optifine) {
    return [];
  }
  const out = [];
  const seen = new Set();
  const add = (slug) => {
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push(slug);
    }
  };
  if (p.shaderFps) SHADER_FPS_SLUGS.forEach(add);
  if (p.embossedBlocks) EMBOSSED_SLUGS.forEach(add);
  if (p.voiceChat) add(VOICE_CHAT_SLUG);
  if (fullbrightNeedsPolytone(p, gameVersion)) add(POLYTONE_SLUG);
  if (betterLeavesNeedsCullLeaves(p)) add(CULL_LEAVES_SLUG);
  if (glowingOresNeedsContinuity(p)) add(CONTINUITY_SLUG);
  if (p.clientHudPack) {
    for (const slug of CLIENT_HUD_REQUIRED_SLUGS) add(slug);
    for (const slug of CLIENT_HUD_MOD_SLUGS) add(slug);
  }
  return out;
}

// OptiFine modpack'i Continuity gibi opsiyonel modları `*.jar.disabled` olarak
// getiriyor. Kullanıcı "kabartma" preset'ini de seçtiyse bu modları etkinleştir.
const OPTIFINE_EMBOSSED_MOD_PREFIXES = Object.freeze(['continuity']);

/** OptiFine mrpack eski surumle getirir; Modrinth'ten yeniden cekilir. */
const OPTIFINE_RECONCILE_SLUGS = Object.freeze([
  'krypton',
  'lithium',
  'ferritecore',
  'immediatelyfast',
  'modmenu',
  'dynamic-fps',
  'fabric-language-kotlin',
  'forgeconfigapiport',
]);

const OPTIFINE_RECONCILE_JAR_TESTS = Object.freeze({
  krypton: /^krypton-/i,
  lithium: /^lithium-fabric-/i,
  ferritecore: /^ferritecore-/i,
  immediatelyfast: /^immediatelyfast/i,
  modmenu: /^modmenu-/i,
  'dynamic-fps': /^dynamic[-_]?fps/i,
  'fabric-language-kotlin': /^fabric-language-kotlin/i,
  forgeconfigapiport: /^forgeconfigapiport/i,
});

/** OptiFine paketinde rrls vb. ile cakisan modlar — kaldirilir, yeniden indirilmez. */
const OPTIFINE_STRIP_JAR_TESTS = Object.freeze([
  /^dark-loading-screen/i,
  /^macos[-_]?input/i,
]);

function stripOptifineConflictingJars(modsDir, jars) {
  if (!fs.existsSync(modsDir)) {
    return Array.isArray(jars)
      ? jars.filter((name) => !OPTIFINE_STRIP_JAR_TESTS.some((re) => re.test(String(name).toLowerCase())))
      : [];
  }
  let out = Array.isArray(jars)
    ? jars.filter((name) => !OPTIFINE_STRIP_JAR_TESTS.some((re) => re.test(String(name).toLowerCase())))
    : [];
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar') && !entry.endsWith('.jar.disabled')) continue;
    if (!OPTIFINE_STRIP_JAR_TESTS.some((re) => re.test(entry.toLowerCase()))) continue;
    removeIfExists(path.join(modsDir, entry));
    out = out.filter((name) => name !== entry);
  }
  return out;
}

function enableOptifineEmbossedMods(modsDir) {
  if (!fs.existsSync(modsDir)) return [];
  const enabled = [];
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar.disabled')) continue;
    const lower = entry.toLowerCase();
    if (!OPTIFINE_EMBOSSED_MOD_PREFIXES.some((p) => lower.startsWith(p))) continue;
    const from = path.join(modsDir, entry);
    const to = path.join(modsDir, entry.slice(0, -'.disabled'.length));
    fs.renameSync(from, to);
    enabled.push(path.basename(to));
  }
  return enabled;
}

// Continuity'nin yan-yana bağlı doku (CTM) etkisi ancak built-in resource
// pack'leri Minecraft'ın `options.txt` `resourcePacks` listesinde yer aldığında
// görünür. Mod yokken Minecraft bu paketleri otomatik kaldırıyor, mod tekrar
// yüklendiğinde geri eklemiyor.
const CONTINUITY_PACKS = Object.freeze(['continuity:default', 'continuity:glass_pane_culling_fix']);

function ensureContinuityResourcePacks(gameRoot) {
  const optionsPath = path.join(gameRoot, 'options.txt');
  if (!fs.existsSync(optionsPath)) return;
  const original = fs.readFileSync(optionsPath, 'utf8');
  const match = original.match(/^resourcePacks:(.*)$/m);
  if (!match) return;
  let arr;
  try {
    arr = JSON.parse(match[1].trim());
  } catch {
    return;
  }
  if (!Array.isArray(arr)) return;
  const missing = CONTINUITY_PACKS.filter((p) => !arr.includes(p));
  if (missing.length === 0) return;
  const vanillaIdx = arr.indexOf('vanilla');
  const insertAt = vanillaIdx >= 0 ? vanillaIdx + 1 : 0;
  arr.splice(insertAt, 0, ...missing);
  const updated = original.replace(/^resourcePacks:.*$/m, `resourcePacks:${JSON.stringify(arr)}`);
  fs.writeFileSync(optionsPath, updated, 'utf8');
}

const MANAGED_MOD_RESOURCE_PACKS = Object.freeze([
  FULLBRIGHT_PACK_LOCAL_NAME,
  BETTER_LEAVES_PACK_LOCAL_NAME,
  GLOWING_ORES_PACK_LOCAL_NAME,
  CROPS_3D_PACK_LOCAL_NAME,
  ROUND_TREES_PACK_LOCAL_NAME,
]);

function managedModResourcePackEntries() {
  return MANAGED_MOD_RESOURCE_PACKS.map((name) => `file/${name}`);
}

function continuityResourcePacksNeeded(presets) {
  return !!(presets.embossedBlocks || glowingOresNeedsContinuity(presets));
}

function modResourcePackFilenamesForPresets(presets) {
  const files = [];
  if (presets.fullbrightUb) files.push(FULLBRIGHT_PACK_LOCAL_NAME);
  if (presets.betterLeaves) files.push(BETTER_LEAVES_PACK_LOCAL_NAME);
  if (presets.glowingOres) files.push(GLOWING_ORES_PACK_LOCAL_NAME);
  if (presets.crops3d) files.push(CROPS_3D_PACK_LOCAL_NAME);
  // Round Trees diğer paketlerin üstünde olmalı (Modrinth önerisi).
  if (presets.roundTrees) files.push(ROUND_TREES_PACK_LOCAL_NAME);
  return files;
}

function readPreservedUserResourcePacks(optionsPath) {
  if (!fs.existsSync(optionsPath)) return [];
  const match = fs.readFileSync(optionsPath, 'utf8').match(/^resourcePacks:(.*)$/m);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[1].trim());
    if (!Array.isArray(arr)) return [];
    const managed = new Set(['vanilla', ...CONTINUITY_PACKS, ...managedModResourcePackEntries()]);
    return arr.filter((entry) => !managed.has(entry));
  } catch {
    return [];
  }
}

function writeResourcePacksLine(optionsPath, entries) {
  const resourceLine = `resourcePacks:${JSON.stringify(entries)}`;
  if (!fs.existsSync(optionsPath)) {
    fs.writeFileSync(optionsPath, `${resourceLine}\n`, 'utf8');
    return;
  }
  const original = fs.readFileSync(optionsPath, 'utf8');
  if (/^resourcePacks:.*$/m.test(original)) {
    fs.writeFileSync(optionsPath, original.replace(/^resourcePacks:.*$/m, resourceLine), 'utf8');
    return;
  }
  const sep = original.endsWith('\n') || original.length === 0 ? '' : '\n';
  fs.writeFileSync(optionsPath, `${original}${sep}${resourceLine}\n`, 'utf8');
}

function applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir }) {
  let p = normalizePresets(presets);
  if (
    p.fullbrightUb &&
    !marsanaClientModService.isFeatureEnabled(
      gameRoot,
      marsanaClientModService.FULLBRIGHT_FEATURE_ID,
      true
    )
  ) {
    p = { ...p, fullbrightUb: false };
  }
  const files = modResourcePackFilenamesForPresets(p);
  const needContinuity = continuityResourcePacksNeeded(p);
  if (files.length === 0 && !needContinuity) return;

  const enabledFiles = [];
  for (const localName of files) {
    const zipPath = path.join(resourcepacksDir, localName);
    if (!fs.existsSync(zipPath)) continue;
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
    enabledFiles.push(localName);
  }

  const optionsPath = path.join(gameRoot, 'options.txt');
  const preserved = readPreservedUserResourcePacks(optionsPath);
  const entries = ['vanilla'];
  if (needContinuity) {
    for (const pack of CONTINUITY_PACKS) {
      if (!entries.includes(pack)) entries.push(pack);
    }
  }
  for (const localName of enabledFiles) {
    const entry = `file/${localName}`;
    if (!entries.includes(entry)) entries.push(entry);
  }
  for (const entry of preserved) {
    if (!entries.includes(entry)) entries.push(entry);
  }
  writeResourcePacksLine(optionsPath, entries);
  if (needContinuity) ensureContinuityResourcePacks(gameRoot);
}

function ensureFileResourcePackInOptions(gameRoot, filename) {
  const optionsPath = path.join(gameRoot, 'options.txt');
  const entry = `file/${filename}`;

  if (!fs.existsSync(optionsPath)) {
    fs.writeFileSync(
      optionsPath,
      `resourcePacks:["vanilla","${entry}"]\n`,
      'utf8'
    );
    return;
  }

  const original = fs.readFileSync(optionsPath, 'utf8');
  const match = original.match(/^resourcePacks:(.*)$/m);
  if (!match) {
    const sep = original.endsWith('\n') || original.length === 0 ? '' : '\n';
    fs.writeFileSync(optionsPath, `${original}${sep}resourcePacks:["vanilla","${entry}"]\n`, 'utf8');
    return;
  }
  let arr;
  try {
    arr = JSON.parse(match[1].trim());
  } catch {
    return;
  }
  if (!Array.isArray(arr)) return;
  if (arr.includes(entry)) return;
  const vanillaIdx = arr.indexOf('vanilla');
  const insertAt = vanillaIdx >= 0 ? vanillaIdx + 1 : 0;
  arr.splice(insertAt, 0, entry);
  const updated = original.replace(/^resourcePacks:.*$/m, `resourcePacks:${JSON.stringify(arr)}`);
  fs.writeFileSync(optionsPath, updated, 'utf8');
}

function clothConfigJarPresent(modsDir) {
  return hudDepsService.clothConfigJarPresent(modsDir);
}

function bundleListsIncompatibleManagedJars(jars, gameVersion) {
  if (!Array.isArray(jars)) return false;
  return jars.some(
    (name) =>
      modCompatibilityService.isManagedModFamilyJar(name) &&
      modCompatibilityService.isJarFilenameIncompatibleWithGame(name, gameVersion)
  );
}

function refreshManagedJarEntries(jars, modsDir, gameVersion) {
  let out = Array.isArray(jars) ? jars.filter(
    (name) =>
      !modCompatibilityService.isManagedModFamilyJar(name) ||
      modCompatibilityService.jarVersionMatchesGame(name, gameVersion)
  ) : [];
  if (!fs.existsSync(modsDir)) return out;
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) continue;
    if (!modCompatibilityService.isManagedModFamilyJar(entry)) continue;
    if (!modCompatibilityService.jarVersionMatchesGame(entry, gameVersion)) continue;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

function clientHudDependenciesOk(modsDir, modPresets) {
  if (!modPresets) return true;
  return hudDepsService.fabricHudRuntimeDepsOk(modsDir, {
    clientHudPack: !!modPresets.clientHudPack,
  });
}

function presetsMatch(saved, wanted) {
  if (
    !saved ||
    typeof saved.shaderFps !== 'boolean' ||
    typeof saved.embossedBlocks !== 'boolean' ||
    typeof saved.optifine !== 'boolean' ||
    typeof saved.voiceChat !== 'boolean' ||
    typeof saved.fullbrightUb !== 'boolean' ||
    typeof saved.betterLeaves !== 'boolean' ||
    typeof saved.glowingOres !== 'boolean' ||
    typeof saved.roundTrees !== 'boolean' ||
    typeof saved.crops3d !== 'boolean' ||
    typeof saved.marsanaClientMenu !== 'boolean' ||
    typeof saved.clientHudPack !== 'boolean'
  ) {
    return false;
  }
  return (
    saved.shaderFps === wanted.shaderFps &&
    saved.embossedBlocks === wanted.embossedBlocks &&
    saved.optifine === wanted.optifine &&
    saved.voiceChat === wanted.voiceChat &&
    saved.fullbrightUb === wanted.fullbrightUb &&
    saved.betterLeaves === wanted.betterLeaves &&
    saved.glowingOres === wanted.glowingOres &&
    saved.roundTrees === wanted.roundTrees &&
    saved.crops3d === wanted.crops3d &&
    saved.marsanaClientMenu === wanted.marsanaClientMenu &&
    saved.clientHudPack === wanted.clientHudPack
  );
}

function readBundle(modsDir) {
  const p = path.join(modsDir, BUNDLE_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeBundle(modsDir, data) {
  fs.writeFileSync(path.join(modsDir, BUNDLE_FILE), JSON.stringify(data, null, 2), 'utf8');
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function allFilesExist(base, names) {
  if (!Array.isArray(names)) return true;
  return names.every((n) => n && fs.existsSync(path.join(base, n)));
}

function statusEmitter(emit) {
  return (text) => emit && emit.status && emit.status({ text });
}

function createShaderStackService({ httpClient, fabricInstaller, modrinthClient, mrpackInstaller, repoRoot }) {
  function ensureClothConfigForHud({ modsDir, gameVersion, status, jars }) {
    hudDepsService.recoverFabricModsFromMisstash(modsDir, gameVersion);
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    hudDepsService.reenableClothConfigJar(modsDir);
    let out = Array.isArray(jars) ? jars.slice() : [];
    if (repoRoot) {
      const bundled = hudDepsService.installBundledClothConfig({
        repoRoot,
        modsDir,
        gameVersion,
        onNotice: status,
      });
      if (bundled && !out.includes(bundled)) out.push(bundled);
    }
    return out;
  }

  async function ensureHudRuntimeDepsAsync({ modsDir, gameVersion, status, jars, presets }) {
    let out = ensureClothConfigForHud({ modsDir, gameVersion, status, jars });
    const clientHudPack = !!(presets && presets.clientHudPack);
    if (!hudDepsService.fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack })) return out;

    const slugsToFetch = [];
    if (
      !hudDepsService.fabricKotlinJarPresent(modsDir) &&
      (clientHudPack || hudDepsService.kotlinRuntimeDepNeeded(modsDir))
    ) {
      slugsToFetch.push('fabric-language-kotlin');
    }
    if (
      !hudDepsService.modmenuJarPresent(modsDir) &&
      (clientHudPack || hudDepsService.modmenuRuntimeDepNeeded(modsDir))
    ) {
      slugsToFetch.push('modmenu');
    }
    if (clientHudPack && !clothConfigJarPresent(modsDir)) {
      slugsToFetch.push('cloth-config');
    }

    if (slugsToFetch.length > 0) {
      const requiredJars = await downloadModsFromSlugs({
        modsDir,
        gameVersion,
        slugs: [...new Set(slugsToFetch)],
      });
      out = [...new Set([...out, ...requiredJars])];
    }

    if (!hudDepsService.fabricHudRuntimeDepsOk(modsDir, { clientHudPack })) {
      const missing = [];
      if (
        (clientHudPack || hudDepsService.kotlinRuntimeDepNeeded(modsDir)) &&
        !hudDepsService.fabricKotlinJarPresent(modsDir)
      ) {
        missing.push('fabric-language-kotlin');
      }
      if (
        (clientHudPack || hudDepsService.modmenuRuntimeDepNeeded(modsDir)) &&
        !hudDepsService.modmenuJarPresent(modsDir)
      ) {
        missing.push('modmenu');
      }
      if (clientHudPack && !clothConfigJarPresent(modsDir)) missing.push('cloth-config');
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Fabric calisma modlari kurulamadi (${missing.join(', ')}). Internet baglantinizi kontrol edip tekrar deneyin.`
      );
    }
    return out;
  }

  async function ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars }) {
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    let out = Array.isArray(jars) ? jars.slice() : [];
    const need = [];

    if (presets.shaderFps && !presets.optifine) {
      if (!modCompatibilityService.coreSodiumJarPresent(modsDir, gameVersion)) need.push('sodium');
      if (!modCompatibilityService.coreIrisJarPresent(modsDir, gameVersion)) need.push('iris');
    }
    if (continuityResourcePacksNeeded(presets)) {
      if (!modCompatibilityService.continuityJarPresent(modsDir, gameVersion)) need.push('continuity');
    }

    if (need.length) {
      status(`Mod cekirdegi guncelleniyor (${need.join(', ')})...`);
      const coreJars = await downloadModsFromSlugs({ modsDir, gameVersion, slugs: need });
      out = [...new Set([...out, ...coreJars])];
    }

    const hasFabricApi = fs.existsSync(modsDir) &&
      fs.readdirSync(modsDir).some(
        (f) => /^fabric-api/i.test(f) && f.endsWith('.jar') && modCompatibilityService.jarVersionMatchesGame(f, gameVersion)
      );
    if ((presets.shaderFps || presets.embossedBlocks || presets.glowingOres) && !hasFabricApi) {
      status('Fabric API eksik, indiriliyor...');
      const apiJars = await downloadModsFromSlugs({ modsDir, gameVersion, slugs: ['fabric-api'] });
      out = [...new Set([...out, ...apiJars])];
    }

    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    return out;
  }

  async function ensureOptifineReconciledMods({ modsDir, gameVersion, status, jars }) {
    if (!fs.existsSync(modsDir)) return Array.isArray(jars) ? jars.slice() : [];
    let out = Array.isArray(jars) ? jars.slice() : [];
    const slugsToRefresh = [];

    for (const slug of OPTIFINE_RECONCILE_SLUGS) {
      const test = OPTIFINE_RECONCILE_JAR_TESTS[slug];
      if (!test) continue;
      const hasFamilyJar = fs.readdirSync(modsDir).some(
        (f) => test.test(f) && (f.endsWith('.jar') || f.endsWith('.jar.disabled'))
      );
      if (!hasFamilyJar) continue;
      modCompatibilityService.removeModFamilyJars(modsDir, (f) => test.test(f));
      slugsToRefresh.push(slug);
      out = out.filter((name) => !test.test(String(name)));
    }

    if (!slugsToRefresh.length) return out;

    status(`OptiFine paketi modlari guncelleniyor (${slugsToRefresh.join(', ')})...`);
    const fresh = [];
    for (const slug of slugsToRefresh) {
      try {
        const jars = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [slug],
        });
        fresh.push(...jars);
      } catch {
        /* OptiFine paketindeki yardimci mod bu surumde yoksa atla — kirli jar zaten silindi */
      }
    }
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    return [...new Set([...out, ...fresh])];
  }

  async function ensureOptifineZoomify({ modsDir, gameVersion, status, jars }) {
    if (!/^26\./.test(String(gameVersion || '').trim())) return Array.isArray(jars) ? jars.slice() : [];
    let out = Array.isArray(jars) ? jars.slice() : [];
    const hasZoomify = fs.existsSync(modsDir) &&
      fs.readdirSync(modsDir).some((f) => /^zoomify/i.test(f) && f.endsWith('.jar'));
    if (hasZoomify) return out;
    status('Zoom (C) için Zoomify kuruluyor — resmi OptiFine 26.x henüz yok.');
    try {
      const fresh = await downloadModsFromSlugs({ modsDir, gameVersion, slugs: ['zoomify'] });
      out = [...new Set([...out, ...fresh])];
    } catch {
      /* optional */
    }
    return out;
  }

  async function finalizeOptifineModState({ modsDir, gameVersion, status, jars, presets }) {
    if (!presets || !presets.optifine) return Array.isArray(jars) ? jars.slice() : [];
    let out = stripOptifineConflictingJars(modsDir, jars);
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    out = await ensureOptifineReconciledMods({
      modsDir,
      gameVersion,
      status,
      jars: out,
    });
    out = stripOptifineConflictingJars(modsDir, out);
    out = await ensureOptifineZoomify({ modsDir, gameVersion, status, jars: out });
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    return refreshManagedJarEntries(out, modsDir, gameVersion);
  }

  function cachedReady({ versionDir, modsDir, shaderpacksDir, resourcepacksDir, gameVersion, versionJsonPath, readyPath, modPresets, shaderSlug }) {
    const existing = readBundle(modsDir);
    const expectedPack = modPresets.shaderFps && !modPresets.optifine ? shaderPackLocalName(shaderSlug) : null;
    if (
      !existing ||
      (existing.bundleVersion || 1) < SHADER_BUNDLE_VERSION ||
      !presetsMatch(existing.presets, modPresets) ||
      !fs.existsSync(versionJsonPath) ||
      !fs.existsSync(readyPath) ||
      existing.gameVersion !== gameVersion ||
      existing.shaderSlug !== shaderSlug ||
      (expectedPack && (existing.shaderpacks || [])[0] !== expectedPack) ||
      !allFilesExist(modsDir, existing.jars) ||
      !allFilesExist(shaderpacksDir, existing.shaderpacks || []) ||
      !allFilesExist(resourcepacksDir, existing.resourcepacks || []) ||
      (existing.shaderpacks || []).some((name) => /§/.test(String(name))) ||
      !clientHudDependenciesOk(modsDir, modPresets) ||
      (modPresets.marsanaClientMenu && !marsanaClientModService.marsanaClientJarPresent(modsDir)) ||
      (modPresets.shaderFps &&
        !modPresets.optifine &&
        !modCompatibilityService.coreSodiumJarPresent(modsDir, gameVersion)) ||
      (modPresets.shaderFps &&
        !modPresets.optifine &&
        !modCompatibilityService.coreIrisJarPresent(modsDir, gameVersion)) ||
      (continuityResourcePacksNeeded(modPresets) &&
        !modCompatibilityService.continuityJarPresent(modsDir, gameVersion)) ||
      bundleListsIncompatibleManagedJars(existing.jars, gameVersion) ||
      (!modPresets.clientHudPack &&
        !modPresets.marsanaClientMenu &&
        modIsolationService.activeClientPackJarsPresent(modsDir)) ||
      (!polytoneSupportedForGameVersion(gameVersion) &&
        (existing.jars || []).some((name) => /^polytone/i.test(String(name))))
    ) {
      return null;
    }
    let assetIndexId = existing.assetIndexId;
    if (!assetIndexId) {
      try {
        const merged = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        assetIndexId = merged.assetIndex?.id || gameVersion;
      } catch {
        assetIndexId = gameVersion;
      }
    }
    return {
      customId: customIdFor(gameVersion, modPresets, shaderSlug),
      assetIndexId,
      shaderpacks: existing.shaderpacks || [],
    };
  }

  async function installFabricProfile({ gameVersion, customId, versionDir, versionJsonPath, fabricChannel = 'stable' }) {
    const { merged, loaderVersion } = await fabricInstaller.buildMergedProfile(gameVersion, {
      channel: fabricChannel,
    });
    merged.id = customId;
    await fs.promises.mkdir(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(merged, null, 2), 'utf8');
    return { merged, loaderVersion };
  }

  // MCLC, Minecraft 1.21+'in numerik asset index ID'sini (örn. "30") gameVersion
  // adıyla kaydedebiliyor; sonuç olarak oyun aradığı `<id>.json`'u bulamayıp
  // panorama, diller ve sesleri yükleyemiyor. Eksikse Mojang'dan indirip
  // doğru isimle yerleştir.
  async function ensureAssetIndexFile({ gameRoot, assetIndex }) {
    if (!assetIndex || !assetIndex.id || !assetIndex.url) return;
    const indexesDir = path.join(gameRoot, 'assets', 'indexes');
    await fs.promises.mkdir(indexesDir, { recursive: true });
    const targetPath = path.join(indexesDir, `${assetIndex.id}.json`);
    if (fs.existsSync(targetPath)) return;
    await httpClient.download(assetIndex.url, targetPath);
  }

  function cleanupPreviousBundle({ modsDir, shaderpacksDir, resourcepacksDir }) {
    const prev = readBundle(modsDir);
    if (!prev) return;
    for (const jar of prev.jars || []) removeIfExists(path.join(modsDir, jar));
    for (const pack of prev.shaderpacks || []) removeIfExists(path.join(shaderpacksDir, pack));
    for (const pack of prev.resourcepacks || []) removeIfExists(path.join(resourcepacksDir, pack));
  }

  // Mojang'ın base sürümleri (1.20, 1.21, 1.19) için mod ekosistemi genelde
  // patch sürümünü (1.20.1, 1.21.1, ...) hedefler — base'ten ilk patch'e mod
  // güncellemesi gelir. Anchor sorgusunu expand edersek Modrinth daha güncel ve
  // birbiriyle uyumlu sürümleri döner.
  function expandGameVersion(v) {
    return modrinthGameVersionCandidates(v);
  }

  function expandLoaderModGameVersion(v) {
    return modrinthLoaderModGameVersionCandidates(v);
  }

  function removeIncompatiblePolytoneJars(modsDir, gameVersion) {
    if (polytoneSupportedForGameVersion(gameVersion) || !fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      if (/^polytone.*\.jar$/i.test(entry)) {
        removeIfExists(path.join(modsDir, entry));
      }
    }
  }

  // Modlar arası "latest" sürümler bazen birbiriyle uyumsuz olabilir (örn. Iris
  // 1.6.11 Modrinth manifest'inde Sodium 0.5.7'yi gösterir ama jar içindeki
  // breaks Sodium >=0.5.7'yi çakışmalı sayar). Çözüm katmanları:
  //  - gameVersion'ı patch ile expand et — yeni anchor'lar gelir.
  //  - Anchor mod (Iris/Continuity) önce çek.
  //  - Anchor'ın Modrinth `dependencies` listesindeki spesifik `version_id`'leri
  //    indir; null ise anchor'ın yayın tarihinden önceki en son uyumlu sürümü
  //    al (contemporary heuristic).
  //  - Aynı projenin tekrar indirilmesini engellemek için downloaded set tutulur.
  async function downloadModsFromSlugs({ modsDir, gameVersion, slugs, modrinthLoaders }) {
    const loaderFilter = Array.isArray(modrinthLoaders) && modrinthLoaders.length
      ? modrinthLoaders
      : ['fabric'];
    const isMc26 = /^26\./.test(String(gameVersion));
    await fs.promises.mkdir(modsDir, { recursive: true });
    removeIncompatiblePolytoneJars(modsDir, gameVersion);
    const jars = [];
    const downloadedVersionIds = new Set();
    const downloadedProjectIds = new Set();

    async function findContemporaryVersion(projectId, anchorPublishedIso, { strictPatch = false } = {}) {
      const anchorTs = Date.parse(anchorPublishedIso || '') || Date.now();
      const candidates = expandLoaderModGameVersion(gameVersion);
      const pickOpts = { anchorTs, gameVersion, gameVersionCandidates: candidates };
      const strictList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
        gameVersions: candidates,
      });
      const strictPick = pickNewestModrinthVersion(strictList, { ...pickOpts, strictPatch });
      if (strictPick) return strictPick;

      if (isMc26) return null;

      if (/^\d+\.\d+\.\d+$/.test(String(gameVersion))) {
        return null;
      }

      const looseList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
      });
      return pickNewestModrinthVersion(looseList, { ...pickOpts, strictPatch: false });
    }

    async function persistVersion(version) {
      if (!version || downloadedVersionIds.has(version.id)) return;
      const file = modrinthClient.primaryFileOf(version);
      if (!file) return;
      downloadedVersionIds.add(version.id);
      if (version.project_id) downloadedProjectIds.add(version.project_id);
      await httpClient.download(file.url, path.join(modsDir, file.filename));
      jars.push(file.filename);

      for (const dep of version.dependencies || []) {
        if (dep.dependency_type !== 'required') continue;
        if (dep.project_id && downloadedProjectIds.has(dep.project_id)) continue;
        let depVersion = null;
        if (dep.version_id) {
          depVersion = await modrinthClient.versionById(dep.version_id);
          const depOk = isMc26
            ? versionMatchesLoaderModGame(depVersion, gameVersion)
            : versionMatchesGameForFetch(depVersion, gameVersion, { strictPatch: true });
          if (depVersion && !depOk && dep.project_id) {
            const override = await findContemporaryVersion(dep.project_id, version.date_published, {
              strictPatch: true,
            });
            if (override) depVersion = override;
          }
        } else if (dep.project_id) {
          depVersion = await findContemporaryVersion(dep.project_id, version.date_published);
        }
        if (
          depVersion &&
          isMc26 &&
          !versionMatchesLoaderModGame(depVersion, gameVersion)
        ) {
          depVersion = null;
        }
        if (depVersion) await persistVersion(depVersion);
      }
    }

    for (const slug of slugs) {
      let version;
      try {
        const candidates = expandLoaderModGameVersion(gameVersion);
        let versions = await modrinthClient.listProjectVersions(slug, {
          loaders: loaderFilter,
          gameVersions: candidates,
        });
        if (versions.length === 0 && isMc26) {
          versions = await modrinthClient.listProjectVersions(slug, { loaders: loaderFilter });
        }
        version = pickNewestModrinthVersion(versions, {
          gameVersion,
          gameVersionCandidates: candidates,
          strictPatch: usesStrictModrinthPatch(gameVersion) || STRICT_PATCH_MOD_SLUGS.has(slug),
        });
        if (!version) {
          if (OPTIONAL_LOADER_MOD_SLUGS.has(slug)) continue;
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Modrinth: "${slug}" için uygun sürüm bulunamadı.`
          );
        }
      } catch (err) {
        if (OPTIONAL_LOADER_MOD_SLUGS.has(slug)) continue;
        if (err && err.code === Codes.MODRINTH_NOT_FOUND) {
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Bu Minecraft sürümü (${gameVersion}) için "${slug}" modunun ${loaderFilter.join('/')} uyumlu sürümü Modrinth'te yok. ` +
              'Snapshot/henüz yayınlanmamış sürümlerde bu modlar olmaz — stable bir release (örn. 1.21.4, 1.20.1) seçin.'
          );
        }
        throw err;
      }
      if (version.project_id && downloadedProjectIds.has(version.project_id)) continue;
      await persistVersion(version);
    }
    return jars;
  }

  async function downloadShaderPack({ shaderpacksDir, gameVersion, loaders, shaderSlug, onNotice }) {
    const expanded = (function expand(v) {
      const m = String(v).match(/^(\d+\.\d+)$/);
      return m ? [v, `${v}.1`] : [v];
    })(gameVersion);
    const loaderFilter = Array.isArray(loaders) && loaders.length ? loaders : ['iris'];
    const slug = resolveShaderSlug(shaderSlug);

    const queryAttempts = [
      { loaders: loaderFilter, gameVersions: expanded },
      { loaders: loaderFilter },
      { gameVersions: expanded },
      {},
    ];

    let lastErr = null;
    for (const query of queryAttempts) {
      try {
        const file = await modrinthClient.latestPrimaryFile(slug, query);
        const safeName = shaderPackLocalName(slug);
        cleanupStaleShaderPacks(shaderpacksDir, slug);
        await fs.promises.mkdir(shaderpacksDir, { recursive: true });
        await httpClient.download(file.url, path.join(shaderpacksDir, safeName));
        if (onNotice) {
          onNotice(`Shader paketi hazır: ${safeName}`);
        }
        return [safeName];
      } catch (err) {
        lastErr = err;
        if (!isModrinthNotFound(err)) break;
      }
    }

    if (slug !== DEFAULT_SHADER_SLUG && isModrinthNotFound(lastErr)) {
      if (onNotice) {
        onNotice(
          `"${slug}" bu Minecraft sürümünde bulunamadı — Complementary Reimagined kullanılıyor.`
        );
      }
      try {
        const fallback = await modrinthClient.latestPrimaryFile(DEFAULT_SHADER_SLUG, {
          loaders: loaderFilter,
          gameVersions: expanded,
        });
        const safeName = shaderPackLocalName(DEFAULT_SHADER_SLUG);
        cleanupStaleShaderPacks(shaderpacksDir, DEFAULT_SHADER_SLUG);
        await fs.promises.mkdir(shaderpacksDir, { recursive: true });
        await httpClient.download(fallback.url, path.join(shaderpacksDir, safeName));
        return [safeName];
      } catch {
        return [];
      }
    }

    if (lastErr) throw lastErr;
    return [];
  }

  // Iris shader paketi otomatik aktivasyonu: indirilen pack zaten varsa kullanıcının
  // Options → Video → Shader Packs menüsüne girip seçmesi gerekmesin. Iris ilk açılışta
  // boş bir `shaderPack=` yazıyor; mevcut satırı (varsa) güncelle, yoksa ekle.
  function writeShaderPropertiesFile(propsPath, shaderpackFilename) {
    let body = '';
    if (fs.existsSync(propsPath)) {
      body = fs.readFileSync(propsPath, 'utf8');
    } else {
      fs.mkdirSync(path.dirname(propsPath), { recursive: true });
    }
    const lines = body ? body.split(/\r?\n/) : [];
    let touchedPack = false;
    let touchedEnable = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^shaderPack\s*=/.test(lines[i])) {
        lines[i] = `shaderPack=${shaderpackFilename}`;
        touchedPack = true;
      } else if (/^enableShaders\s*=/.test(lines[i])) {
        lines[i] = 'enableShaders=true';
        touchedEnable = true;
      }
    }
    if (!touchedPack) lines.push(`shaderPack=${shaderpackFilename}`);
    if (!touchedEnable) lines.push('enableShaders=true');
    fs.writeFileSync(propsPath, `${lines.join('\n')}\n`, 'utf8');
  }

  function activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'iris.properties'), shaderpackFilename);
  }

  // Oculus (Iris'in Forge/NeoForge fork'u) kendi config dosyasını kullanır:
  // `config/oculus.properties`. Format Iris ile aynı.
  function activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'oculus.properties'), shaderpackFilename);
  }

  // OptiFine'ın shader config dosyası ayrı: `optionsshaders.txt`. Format ana
  // options.txt'e benzer ama OptiFine bunu shader pack seçimi için okur.
  function activateShaderPackInOptifineConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    const optionsPath = path.join(gameRoot, 'optionsshaders.txt');
    let body = '';
    if (fs.existsSync(optionsPath)) body = fs.readFileSync(optionsPath, 'utf8');
    const lines = body ? body.split(/\r?\n/) : [];
    let touched = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^shaderPack:/.test(lines[i])) {
        lines[i] = `shaderPack:${shaderpackFilename}`;
        touched = true;
        break;
      }
    }
    if (!touched) lines.push(`shaderPack:${shaderpackFilename}`);
    fs.writeFileSync(optionsPath, lines.join('\n'), 'utf8');
  }

  // Forge / NeoForge için launch öncesi eski shader mod jar'larını temizle.
  // Aynı kategoride iki sürüm (örn. Rubidium + Embeddium ya da Oculus + Iris)
  // duplicate hatası verir — sıfırdan kuruyoruz ki tutarlı kombinasyon olsun.
  //
  // ÖNEMLİ: hem aktif `.jar` hem stash kopyalarını siliyoruz. Aksi halde
  // applyLoaderModsState bir sonraki loader geçişinde eski stash'i restore
  // edip eski Rubidium'u geri getirir ve yeni Embeddium ile çakışır.
  const FORGE_FAMILY_SHADER_PREFIXES = ['oculus', 'rubidium', 'embeddium', 'iris', 'sodium'];
  function cleanupForgeFamilyShaderJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_FAMILY_SHADER_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  // Forge ailesinde kabartma için yönetilen jar'lar: Continuity (Forge/NeoForge).
  const FORGE_FAMILY_EMBOSSED_PREFIXES = ['continuity'];
  function cleanupForgeFamilyEmbossedJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_FAMILY_EMBOSSED_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  async function installShadersForExternalLoader({ loader, gameRoot, gameVersion, emit, shaderSlug }) {
    const modsDir = path.join(gameRoot, 'mods');
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const status = statusEmitter(emit);
    const resolvedSlug = resolveShaderSlug(shaderSlug);

    repairLegacyShaderPack({
      gameRoot,
      shaderpacksDir,
      shaderSlug: resolvedSlug,
      activateFns: [
        activateShaderPackInIrisConfig,
        activateShaderPackInOculusConfig,
      ],
    });

    // Eski shader mod kombinasyonlarını temizle — duplicate riskini önler.
    if (loader === 'forge' || loader === 'neoforge') {
      cleanupForgeFamilyShaderJars(modsDir);
    }

    if (loader === 'forge-optifine') {
      status('Shader paketi indiriliyor (OptiFine için)...');
      const packs = await downloadShaderPack({
        shaderpacksDir,
        gameVersion,
        loaders: ['optifine', 'iris'],
        shaderSlug,
        onNotice: status,
      });
      if (packs[0]) {
        activateShaderPackInOptifineConfig({ gameRoot, shaderpackFilename: packs[0] });
      }
      return { jars: [], shaderpacks: packs };
    }

    // Anchor mod yeterli — Modrinth'in `dependencies` listesi Sodium/Embeddium
    // gibi gerekli bağımlılıkları zaten getiriyor. Ek slug yazarsak bir
    // projenin iki sürümünü (örn. Rubidium + Embeddium) yan yana indirebiliriz
    // ve Forge bunu "duplicate mod" diye reddeder.
    const SLUGS_BY_LOADER = {
      forge: ['oculus'],
      neoforge: ['iris'],
      quilt: ['iris'],
    };
    const slugs = SLUGS_BY_LOADER[loader];
    if (!slugs) {
      throw new Error(`installShadersForExternalLoader: desteklenmeyen loader: ${loader}`);
    }

    status(`Shader modları indiriliyor (${loader})...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs,
      modrinthLoaders: [loader],
    });

    status('Shader paketi indiriliyor...');
    const packs = await downloadShaderPack({
      shaderpacksDir,
      gameVersion,
      loaders: ['iris'], // Oculus de Iris API'sini kullanır, aynı paket
      shaderSlug,
      onNotice: status,
    });
    if (packs[0]) {
      if (loader === 'forge') {
        // Oculus kendi config dosyasını okur (oculus.properties), iris.properties değil.
        activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename: packs[0] });
      } else {
        // NeoForge ve Quilt: gerçek Iris mod'u → iris.properties
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: packs[0] });
      }
    }
    return { jars, shaderpacks: packs };
  }

  function cleanupVoiceChatJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!lower.startsWith('voicechat-') && !lower.startsWith('voicechat_')) continue;
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  async function downloadModrinthResourcePack({ slug, localName, resourcepacksDir, gameVersion, label, onNotice }) {
    const candidates = expandResourcePackGameVersions(gameVersion);
    let versions = await modrinthClient.listProjectVersions(slug, { gameVersions: candidates });
    if (!versions.length) {
      versions = (await modrinthClient.listProjectVersions(slug, {}))
        .filter((v) => versionListsGame(v.game_versions, gameVersion));
    }

    const picked = pickNewestModrinthVersion(versions, { gameVersion, gameVersionCandidates: candidates });
    if (!picked) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `${label} bu Minecraft sürümü (${gameVersion}) için Modrinth'te bulunamadı.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, `${label} dosyası Modrinth'te bulunamadı.`);
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, localName));
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
    const versionLabel = picked.name || picked.version_number || label;
    if (onNotice) onNotice(`${label} ${versionLabel} hazır: ${localName}`);
    return [localName];
  }

  async function downloadGlowingOresResourcePack({ resourcepacksDir, gameVersion, onNotice, useContinuity = true }) {
    const candidates = expandResourcePackGameVersions(gameVersion);
    let versions = await modrinthClient.listProjectVersions(GLOWING_ORES_SLUG, { gameVersions: candidates });
    if (!versions.length) {
      versions = (await modrinthClient.listProjectVersions(GLOWING_ORES_SLUG, {}))
        .filter((v) => versionListsGame(v.game_versions, gameVersion));
    }

    const picked = pickGlowingOresVersion(versions, { gameVersion, wantBorder: !!useContinuity });
    if (!picked) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `New Glowing Ores bu Minecraft sürümü (${gameVersion}) için Modrinth'te bulunamadı.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'New Glowing Ores dosyası Modrinth\'te bulunamadı.');
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, GLOWING_ORES_PACK_LOCAL_NAME));
    ensureResourcePackCompatibleForGame({
      resourcepacksDir,
      localName: GLOWING_ORES_PACK_LOCAL_NAME,
      gameVersion,
    });

    const variant = glowingOresVariantLabel(picked);
    const variantLabel = variant === 'border' ? 'Border (Continuity)' : 'Default (OptiFine/Continuity)';
    if (onNotice) onNotice(`New Glowing Ores ${variantLabel} hazır: ${GLOWING_ORES_PACK_LOCAL_NAME}`);
    return [GLOWING_ORES_PACK_LOCAL_NAME];
  }

  async function downloadFullbrightResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    const expanded = expandResourcePackGameVersions(gameVersion);
    let versions = await modrinthClient.listProjectVersions(FULLBRIGHT_UB_SLUG, { gameVersions: expanded });
    if (!versions.length) {
      versions = (await modrinthClient.listProjectVersions(FULLBRIGHT_UB_SLUG, {}))
        .filter((v) => versionListsGame(v.game_versions, gameVersion));
    }

    const picked = pickNewestModrinthVersion(versions, { gameVersion });
    if (!picked) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Fullbright UB bu Minecraft sürümü (${gameVersion}) için Modrinth/CurseForge'ta bulunamadı.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'Fullbright UB dosyası Modrinth\'te bulunamadı.');
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, FULLBRIGHT_PACK_LOCAL_NAME));
    ensureResourcePackCompatibleForGame({
      resourcepacksDir,
      localName: FULLBRIGHT_PACK_LOCAL_NAME,
      gameVersion,
    });

    const label = picked.name || picked.version_number || 'Fullbright UB';
    if (onNotice) onNotice(`Fullbright UB ${label} hazır: ${FULLBRIGHT_PACK_LOCAL_NAME}`);
    return [FULLBRIGHT_PACK_LOCAL_NAME];
  }

  async function downloadBetterLeavesResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    return downloadModrinthResourcePack({
      slug: BETTER_LEAVES_SLUG,
      localName: BETTER_LEAVES_PACK_LOCAL_NAME,
      resourcepacksDir,
      gameVersion,
      label: "Motschen's Better Leaves",
      onNotice,
    });
  }

  async function downloadRoundTreesResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    return downloadModrinthResourcePack({
      slug: ROUND_TREES_SLUG,
      localName: ROUND_TREES_PACK_LOCAL_NAME,
      resourcepacksDir,
      gameVersion,
      label: 'Round Trees',
      onNotice,
    });
  }

  async function downloadCrops3dResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    return downloadModrinthResourcePack({
      slug: CROPS_3D_SLUG,
      localName: CROPS_3D_PACK_LOCAL_NAME,
      resourcepacksDir,
      gameVersion,
      label: '3D crops Revamped',
      onNotice,
    });
  }

  function glowingOresUseContinuityPack({ includeOptifine = false, includeEmbossed = false, presets = null } = {}) {
    if (presets) {
      if (presets.optifine) return false;
      return !!(presets.embossedBlocks || glowingOresNeedsContinuity(presets));
    }
    if (includeOptifine) return false;
    return !!includeEmbossed;
  }

  async function installFullbrightForExternalLoader({
    loader,
    gameRoot,
    gameVersion,
    emit,
    includeShader = false,
    includeOptifine = false,
  }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    status('Fullbright UB kaynak paketi indiriliyor...');
    const resourcepacks = await downloadFullbrightResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    if (resourcepacks[0]) {
      ensureResourcePackCompatibleForGame({ resourcepacksDir, localName: resourcepacks[0], gameVersion });
      ensureFileResourcePackInOptions(gameRoot, resourcepacks[0]);
    }

    if (includeShader && !includeOptifine && (loader === 'fabric' || loader === 'quilt') && polytoneSupportedForGameVersion(gameVersion)) {
      status('Fullbright + Shader için PolyTone indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [POLYTONE_SLUG],
          modrinthLoaders: [loader],
        });
      } catch {
        status('PolyTone bulunamadı — Fullbright Sodium/Iris ile çalışmayabilir.');
      }
    }
    return { resourcepacks };
  }

  async function installRoundTreesForExternalLoader({ gameRoot, gameVersion, emit }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const status = statusEmitter(emit);
    status('Round Trees kaynak paketi indiriliyor...');
    const resourcepacks = await downloadRoundTreesResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    return { resourcepacks };
  }

  async function installCrops3dForExternalLoader({ gameRoot, gameVersion, emit }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const status = statusEmitter(emit);
    status('3D crops Revamped kaynak paketi indiriliyor...');
    const resourcepacks = await downloadCrops3dResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    return { resourcepacks };
  }

  async function installBetterLeavesForExternalLoader({
    loader,
    gameRoot,
    gameVersion,
    emit,
    includeShader = false,
    includeEmbossed = false,
    includeOptifine = false,
  }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    status("Motschen's Better Leaves kaynak paketi indiriliyor...");
    const resourcepacks = await downloadBetterLeavesResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    if (resourcepacks[0]) {
      ensureResourcePackCompatibleForGame({ resourcepacksDir, localName: resourcepacks[0], gameVersion });
      ensureFileResourcePackInOptions(gameRoot, resourcepacks[0]);
    }

    const modLoader = loader === 'forge-optifine' ? 'forge' : loader;
    if (!includeOptifine && ['fabric', 'quilt', 'forge', 'neoforge'].includes(modLoader)) {
      status('Better Leaves için Cull Leaves indiriliyor (Sodium/Embeddium bağımlılıkları otomatik)...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CULL_LEAVES_SLUG],
          modrinthLoaders: [modLoader],
        });
      } catch {
        status('Cull Leaves bulunamadı — OptiFine Smart Leaves veya Fabric yükleyici deneyin.');
      }
    } else if (loader === 'vanilla') {
      status(
        "Better Leaves: Vanilla'da tam etki için Fabric + Cull Leaves veya Forge/OptiFine + Smart Leaves kullanın."
      );
    }
    return { resourcepacks };
  }

  async function installGlowingOresForExternalLoader({
    loader,
    gameRoot,
    gameVersion,
    emit,
    includeOptifine = false,
    includeEmbossed = false,
  }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    const modLoader = loader === 'forge-optifine' ? 'forge' : loader;
    const willInstallContinuity =
      !includeOptifine && !includeEmbossed && ['fabric', 'quilt', 'forge'].includes(modLoader);
    const useContinuityPack = includeEmbossed || willInstallContinuity;

    status('New Glowing Ores kaynak paketi indiriliyor...');
    const resourcepacks = await downloadGlowingOresResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
      useContinuity: useContinuityPack,
    });
    if (resourcepacks[0]) {
      ensureResourcePackCompatibleForGame({ resourcepacksDir, localName: resourcepacks[0], gameVersion });
      ensureFileResourcePackInOptions(gameRoot, resourcepacks[0]);
    }

    if (!includeOptifine && !includeEmbossed && modLoader === 'neoforge') {
      status('Glowing Ores: NeoForge\'da Continuity + Connector gerekir — maden parıltısı görünmeyebilir.');
    } else if (willInstallContinuity) {
      status('Glowing Ores için Continuity indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CONTINUITY_SLUG],
          modrinthLoaders: [modLoader],
        });
        ensureContinuityResourcePacks(gameRoot);
      } catch {
        status('Continuity bulunamadı — OptiFine Emissive Textures veya Kabartmalı bloklar (Continuity) gerekir.');
      }
    } else if (includeOptifine) {
      status('Glowing Ores (Default): OptiFine\'da Video Ayarları → Kalite → Emissive Textures açın.');
    } else if (loader === 'vanilla') {
      status('Glowing Ores (Default): Vanilla\'da parıltı için Fabric+Continuity veya Forge+OptiFine kullanın.');
    }
    return { resourcepacks };
  }

  async function installVoiceChatForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    cleanupVoiceChatJars(modsDir);
    status(`Simple Voice Chat indiriliyor (${loader})...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs: [VOICE_CHAT_SLUG],
      modrinthLoaders: [loader],
    });
    return { jars };
  }

  // Forge ailesi loader'lar için kabartmalı blok (CTM) modunu yükle.
  //   'forge'           → Continuity Forge (sadece 1.20.1; Modrinth'te tek sürüm)
  //   'neoforge'        → Continuity NeoForge (sadece 1.21.1; tek sürüm)
  //   'forge-optifine'  → no-op (OptiFine kendi içinde CTM destekler)
  async function installEmbossedForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);

    if (loader === 'forge-optifine') {
      status('Kabartma: OptiFine kendi içinde bağlı doku desteği sağlıyor — ek mod indirilmedi.');
      return { jars: [] };
    }
    if (loader === 'neoforge') {
      // NeoForge'da Continuity native değil — sadece Sinytra Connector ile
      // çalışan Fabric jar'ı ve bu kombinasyon NeoForge 21.1.x ile
      // ClassCastException (ModFileParser$MixinConfig) atıyor. Indirmeyi
      // atla, kullanıcıyı bilgilendir.
      status('Kabartma: NeoForge bu sürümde Continuity\'yi native desteklemiyor — atlandı.');
      return { jars: [] };
    }
    if (loader !== 'forge') {
      throw new Error(`installEmbossedForExternalLoader: desteklenmeyen loader: ${loader}`);
    }

    cleanupForgeFamilyEmbossedJars(modsDir);

    status(`Kabartma (Continuity ${loader}) indiriliyor...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs: ['continuity'],
      modrinthLoaders: [loader],
    });

    // options.txt'e Continuity resource pack'lerini ekle — Continuity 3.0+ kendi
    // built-in resource pack'lerini sunar ama Minecraft options'ta listelenmek
    // zorundadır, aksi takdirde CTM görünmez.
    ensureContinuityResourcePacks(gameRoot);

    return { jars };
  }

  async function ensure({ gameRoot, gameVersion, emit, modPresets, shaderSlug, fabricChannel = 'stable', playMode }) {
    const presets = normalizePresets(modPresets);
    if (!presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.clientHudPack) {
      throw new Error('shaderStackService.ensure: en az bir mod önayarı gerekli');
    }

    const loaderPrefix = fabricChannel === 'beta' ? 'marsana-fabric-beta' : 'marsana';
    const resolvedShaderSlug = resolveShaderSlug(shaderSlug);
    const status = statusEmitter(emit);
    const customId = customIdFor(gameVersion, presets, resolvedShaderSlug, { loaderPrefix });
    const versionDir = path.join(gameRoot, 'versions', customId);
    const modsDir = path.join(gameRoot, 'mods');
    modIsolationService.enforceModIsolation(modsDir, presets, playMode);
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const versionJsonPath = path.join(versionDir, `${customId}.json`);
    const readyPath = path.join(versionDir, READY_FILE);

    hudDepsService.recoverFabricModsFromMisstash(modsDir, gameVersion);
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);

    repairLegacyShaderPack({
      gameRoot,
      shaderpacksDir,
      shaderSlug: resolvedShaderSlug,
      activateFns: [activateShaderPackInIrisConfig],
    });

    const cached = cachedReady({
      versionDir,
      modsDir,
      shaderpacksDir,
      resourcepacksDir,
      gameVersion,
      versionJsonPath,
      readyPath,
      modPresets: presets,
      shaderSlug: resolvedShaderSlug,
    });
    if (cached) {
      modIsolationService.enforceModIsolation(modsDir, presets, playMode);
      if (presets.shaderFps && !presets.optifine && cached.shaderpacks[0]) {
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: cached.shaderpacks[0] });
      }
      applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir });
      let bundle = readBundle(modsDir);
      let cacheJars = bundle && bundle.jars;
      cacheJars = await ensureShaderCoreMods({
        modsDir,
        gameVersion,
        presets,
        status,
        jars: cacheJars,
      });
      cacheJars = refreshManagedJarEntries(cacheJars, modsDir, gameVersion);
      if (
        presets.clientHudPack ||
        hudDepsService.fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack: !!presets.clientHudPack })
      ) {
        cacheJars = await ensureHudRuntimeDepsAsync({
          modsDir,
          gameVersion,
          status,
          jars: cacheJars,
          presets,
        });
      }
      if (bundle && cacheJars) {
        writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
      }
      if (presets.optifine) {
        cacheJars = await finalizeOptifineModState({
          modsDir,
          gameVersion,
          status,
          jars: cacheJars,
          presets,
        });
        bundle = readBundle(modsDir);
        if (bundle && cacheJars) {
          writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
        }
      }
      if (presets.marsanaClientMenu && repoRoot) {
        const menuJar = marsanaClientModService.installBundledMod({
          repoRoot,
          modsDir,
          gameVersion,
          onNotice: status,
        });
        if (menuJar) {
          bundle = readBundle(modsDir);
          if (bundle) {
            cacheJars = [...new Set([...(cacheJars || []), menuJar])];
            writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
          }
        }
        marsanaClientModService.seedHudFeatureDefaults(gameRoot);
        const cfg = marsanaClientModService.readConfig(gameRoot);
        marsanaClientModService.applyModToggleStates(modsDir, cfg);
      } else if (presets.marsanaClientMenu) {
        const cfg = marsanaClientModService.readConfig(gameRoot);
        marsanaClientModService.applyModToggleStates(modsDir, cfg);
      }
      status(`Mod profili (önbellek): ${resolvedShaderSlug} shader hazır, başlatılıyor...`);
      await installFabricProfile({
        gameVersion,
        customId,
        versionDir,
        versionJsonPath,
        fabricChannel,
      });
      modIsolationService.enforceModIsolation(modsDir, presets, playMode);
      return { customId: cached.customId, assetIndexId: cached.assetIndexId };
    }

    status(`Mod profili: Fabric yükleyici eşleştiriliyor (${gameVersion})...`);
    const { merged, loaderVersion } = await installFabricProfile({
      gameVersion,
      customId,
      versionDir,
      versionJsonPath,
      fabricChannel,
    });
    await ensureAssetIndexFile({ gameRoot, assetIndex: merged.assetIndex });

    status('Mod profili: seçilen modlar indiriliyor...');
    cleanupPreviousBundle({ modsDir, shaderpacksDir, resourcepacksDir });
    removeIncompatiblePolytoneJars(modsDir, gameVersion);

    let optifineMeta = null;
    if (presets.optifine) {
      optifineMeta = await mrpackInstaller.installFromProject({
        projectSlug: OPTIFINE_PROJECT,
        gameVersion,
        gameRoot,
        emit,
      });
    }

    const slugs = modrinthSlugsForPresets(presets, gameVersion);
    if (presets.clientHudPack) {
      status('Client HUD paketi: minimap ve client modlari indiriliyor (uyumlu olanlar)...');
    }
    let jars = slugs.length ? await downloadModsFromSlugs({ modsDir, gameVersion, slugs }) : [];
    if (
      presets.clientHudPack ||
      hudDepsService.fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack: !!presets.clientHudPack })
    ) {
      jars = await ensureHudRuntimeDepsAsync({ modsDir, gameVersion, status, jars, presets });
    }
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    jars = await ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars });
    if (optifineMeta && Array.isArray(optifineMeta.jarNames)) {
      const seen = new Set(jars);
      for (const name of optifineMeta.jarNames) {
        if (!seen.has(name)) {
          seen.add(name);
          jars.push(name);
        }
      }
    }
    if (presets.optifine && presets.embossedBlocks) {
      const enabled = enableOptifineEmbossedMods(modsDir);
      const seen = new Set(jars);
      for (const name of enabled) {
        if (!seen.has(name)) {
          seen.add(name);
          jars.push(name);
        }
      }
    }
    if (optifineMeta || presets.optifine) {
      status('OptiFine paketi sonrasi mod surumleri esitleniyor...');
      jars = await ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars });
      jars = await finalizeOptifineModState({
        modsDir,
        gameVersion,
        status,
        jars,
        presets,
      });
    }

    if (presets.marsanaClientMenu && repoRoot) {
      const menuJar = marsanaClientModService.installBundledMod({
        repoRoot,
        modsDir,
        gameVersion,
        onNotice: status,
      });
      if (menuJar && !jars.includes(menuJar)) {
        jars.push(menuJar);
      }
      marsanaClientModService.seedHudFeatureDefaults(gameRoot);
      const cfg = marsanaClientModService.readConfig(gameRoot);
      marsanaClientModService.applyModToggleStates(modsDir, cfg);
    }

    let resourcepacks = [];
    if (presets.fullbrightUb) {
      status('Mod profili: Fullbright UB kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadFullbrightResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }
    if (presets.betterLeaves) {
      status("Mod profili: Motschen's Better Leaves kaynak paketi indiriliyor...");
      resourcepacks.push(...(await downloadBetterLeavesResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }
    if (presets.glowingOres) {
      status('Mod profili: New Glowing Ores kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadGlowingOresResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
        useContinuity: glowingOresUseContinuityPack({ presets }),
      })));
    }
    if (presets.crops3d) {
      status('Mod profili: 3D crops Revamped kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadCrops3dResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }
    if (presets.roundTrees) {
      status('Mod profili: Round Trees kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadRoundTreesResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }

    applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir });

    let shaderpacks = [];
    if (presets.shaderFps && !presets.optifine) {
      status(`Mod profili: shader paketi indiriliyor (${resolvedShaderSlug})...`);
      shaderpacks = await downloadShaderPack({
        shaderpacksDir,
        gameVersion,
        shaderSlug: resolvedShaderSlug,
        onNotice: status,
      });
      if (shaderpacks[0]) {
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: shaderpacks[0] });
      }
    }

    const assetIndexId = merged.assetIndex?.id || gameVersion;

    fs.writeFileSync(
      readyPath,
      JSON.stringify(
        { gameVersion, customId, assetIndexId, loader: loaderVersion, readyAt: Date.now(), presets, shaderSlug: resolvedShaderSlug },
        null,
        2
      ),
      'utf8'
    );
    writeBundle(modsDir, {
      bundleVersion: SHADER_BUNDLE_VERSION,
      gameVersion,
      loader: loaderVersion,
      jars,
      shaderpacks,
      resourcepacks,
      assetIndexId,
      presets,
      optifineMeta,
      shaderSlug: resolvedShaderSlug,
      updatedAt: Date.now(),
    });

    if (presets.optifine) {
      const packLabel = optifineMeta && optifineMeta.packName ? optifineMeta.packName : 'OptiFine for Fabric';
      const mc26Note = /^26\./.test(String(gameVersion))
        ? ' Resmi OptiFine.jar 26.x\'te henüz yok; zoom için Zoomify (C) eklendi.'
        : '';
      status(
        `${packLabel} kuruldu.${mc26Note} Video ayarları ve shader seçenekleri paket içindeki modlarla gelir; ` +
          'Shader + FPS seçeneğiyle birlikte kullanmayın.'
      );
    } else if (presets.shaderFps && presets.embossedBlocks) {
      status(
        'Mod profili hazır. Shader: Seçenekler → Video → Shader Packs (Complementary’de Performance önerilir). ' +
          'Kabartma: Continuity + Sodium.'
      );
    } else if (presets.shaderFps) {
      status(
        'Shader + FPS profili hazır. Oyun içinde: Seçenekler → Video → Shader Packs; Complementary’de Performance profili önerilir.'
      );
    } else if (presets.voiceChat) {
      status(
        'Simple Voice Chat kuruldu. Oyunda V tuşuna basarak veya ayarlardan mikrofonu yapılandırın; sunucuda da mod gerekir.'
      );
    } else if (presets.fullbrightUb) {
      status(
        fullbrightNeedsPolytone(presets, gameVersion)
          ? 'Fullbright UB kuruldu. Kaynak paketi etkinleştirildi; Sodium/Iris ile PolyTone da yüklendi.'
          : presets.shaderFps && !presets.optifine && !polytoneSupportedForGameVersion(gameVersion)
            ? 'Fullbright UB kuruldu. 26.x sürümünde PolyTone henüz yok — kaynak paketi etkin; tam parlaklık Sodium/Iris ile sınırlı olabilir.'
            : 'Fullbright UB kuruldu. Kaynak paketi indirildi ve Seçenekler → Kaynak paketleri bölümünde etkinleştirildi.'
      );
    } else if (presets.betterLeaves) {
      status(
        betterLeavesNeedsCullLeaves(presets)
          ? presets.optifine
            ? "Motschen's Better Leaves kuruldu. OptiFine → Video Ayarları → Kalite → Smart Leaves açın."
            : "Motschen's Better Leaves kuruldu. Kaynak paketi ve Cull Leaves yüklendi."
          : "Motschen's Better Leaves kuruldu. Kaynak paketi etkinleştirildi."
      );
    } else if (presets.glowingOres) {
      const borderPack = glowingOresUseContinuityPack({ presets });
      status(
        borderPack
          ? 'New Glowing Ores (Border) kuruldu. Continuity ile parıltı ve bağlı çerçeve etkin.'
          : 'New Glowing Ores (Default) kuruldu. OptiFine kullanıyorsanız Emissive Textures açın.'
      );
    } else if (presets.roundTrees) {
      status('Round Trees kuruldu. Kaynak paketi listenin en üstüne yerleştirildi.');
    } else if (presets.crops3d) {
      status('3D crops Revamped kuruldu. Tarım blokları 3D görünüme geçti.');
    } else {
      status('Kabartmalı blok / bağlı doku: Continuity + Sodium hazır.');
    }

    modIsolationService.enforceModIsolation(modsDir, presets, playMode);
    return { customId, assetIndexId };
  }

  return { ensure, applyModResourcePackPresets, installShadersForExternalLoader, installEmbossedForExternalLoader, installVoiceChatForExternalLoader, installFullbrightForExternalLoader, installBetterLeavesForExternalLoader, installGlowingOresForExternalLoader, installRoundTreesForExternalLoader, installCrops3dForExternalLoader };
}

module.exports = { createShaderStackService };
