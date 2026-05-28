'use strict';

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const { LauncherError, Codes } = require('../infra/errors');

const BUNDLE_FILE = '.marsana-mod-bundle.json';
const READY_FILE = '.marsana-shader-ready.json';
const SHADER_BUNDLE_VERSION = 9;

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
const CONTINUITY_SLUG = 'continuity';
const DEFAULT_SHADER_SLUG = 'complementary-reimagined';
const OPTIFINE_PROJECT = 'optifine-for-fabric';

// UI'dan gelen shader slug'ını kabul edilen değerlere kıs — geçersiz/eski bir
// slug Modrinth'te 404'e dönüp tüm launch'u patlatabilir. Tanınmayan slug
// için sessizce default'a düş.
const KNOWN_SHADER_SLUGS = new Set([
  'complementary-reimagined', 'complementary-unbound', 'bsl-shaders',
  'photon-shader', 'solas-shader', 'bliss-shader', 'rethinking-voxels',
  'makeup-ultra-fast-shaders', 'super-duper-vanilla', 'insanity-shader',
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
  const tagged = extractMcVersionFromModMeta(version);
  if (!tagged) return true;
  return tagged === gameVersion;
}

function pickNewestModrinthVersion(versions, { anchorTs, strictPatch = false, gameVersion } = {}) {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  let eligible = versions.filter((v) =>
    strictPatch
      ? versionMatchesGamePatch(v, gameVersion)
      : (v.game_versions || []).includes(gameVersion)
  );
  if (eligible.length === 0 && !strictPatch) {
    eligible = versions.filter((v) => (v.game_versions || []).includes(gameVersion));
  }
  if (eligible.length === 0) return null;

  const ts = typeof anchorTs === 'number' ? anchorTs : Date.now();
  const dated = eligible
    .filter((v) => !v.date_published || Date.parse(v.date_published) <= ts)
    .sort((a, b) => {
      const releaseRank = (v) => (v.version_type === 'release' ? 0 : 1);
      const dr = releaseRank(a) - releaseRank(b);
      if (dr !== 0) return dr;
      return Date.parse(b.date_published || '') - Date.parse(a.date_published || '');
    });
  if (dated.length > 0) return dated[0];
  return eligible.sort(
    (a, b) => Date.parse(b.date_published || '') - Date.parse(a.date_published || '')
  )[0];
}

function expandResourcePackGameVersions(gameVersion) {
  const id = String(gameVersion || '').trim();
  const out = [id];
  const patch = id.match(/^(\d+\.\d+)\.\d+$/);
  if (patch) out.push(patch[1]);
  const base = id.match(/^(\d+\.\d+)$/);
  if (base) out.push(`${base[1]}.1`);
  return [...new Set(out)];
}

function versionListsGame(versions, gameVersion) {
  const gvs = versions || [];
  const expanded = expandResourcePackGameVersions(gameVersion);
  return expanded.some((gv) => gvs.includes(gv));
}

function glowingOresVariantLabel(version) {
  const hay = `${version.name || ''} ${version.version_number || ''} ${(version.files && version.files[0] && version.files[0].filename) || ''}`.toLowerCase();
  if (hay.includes('border') || hay.includes('[bv') || hay.includes('bv-')) return 'border';
  if (hay.includes('default') || hay.includes('[dv') || hay.includes('dv-')) return 'default';
  return 'unknown';
}

function glowingOresVersionMatchesGame(version, gameVersion) {
  const gvs = version.game_versions || [];
  if (gvs.includes(gameVersion)) return true;
  const m = String(gameVersion).match(/^(\d+\.\d+)$/);
  if (m && gvs.includes(`${m[1]}.1`)) return true;
  return false;
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
  if (min <= format && max >= format && pack.pack_format == null && pack.supported_formats == null) {
    return true;
  }
  return pack.min_format === format && pack.max_format === format && pack.pack_format == null;
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

  zip.updateFile('pack.mcmeta', Buffer.from(`${JSON.stringify(meta, null, 3)}\n`, 'utf8'));
  zip.writeZip(zipPath);
  return true;
}

function ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion }) {
  if (!localName || !resourcepacksDir) return;
  patchResourcePackZipForGameVersion(path.join(resourcepacksDir, localName), gameVersion);
}

function pickGlowingOresVersion(versions, { gameVersion, wantBorder }) {
  if (!Array.isArray(versions) || versions.length === 0) return null;
  let eligible = versions.filter((v) => glowingOresVersionMatchesGame(v, gameVersion));
  if (eligible.length === 0) eligible = versions.slice();

  const preferred = wantBorder ? 'border' : 'default';
  let pool = eligible.filter((v) => glowingOresVariantLabel(v) === preferred);
  if (pool.length === 0 && !wantBorder) {
    pool = eligible.filter((v) => glowingOresVariantLabel(v) !== 'border');
  }
  if (pool.length === 0) pool = eligible;

  pool.sort((a, b) => Date.parse(b.date_published || '') - Date.parse(a.date_published || ''));
  return pool[0] || null;
}

function customIdFor(gameVersion, presets, shaderSlug, { loaderPrefix = 'marsana' } = {}) {
  if (presets.optifine) return `${loaderPrefix}-optifine-${gameVersion}`;
  if (presets.shaderFps && shaderSlug && KNOWN_SHADER_SLUGS.has(shaderSlug)) {
    return `${loaderPrefix}-shader-${gameVersion}-${shaderSlug}`;
  }
  if (presets.voiceChat && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres) {
    return `${loaderPrefix}-voice-${gameVersion}`;
  }
  if (presets.fullbrightUb && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.betterLeaves && !presets.glowingOres) {
    return `${loaderPrefix}-fullbright-${gameVersion}`;
  }
  if (presets.betterLeaves && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.glowingOres) {
    return `${loaderPrefix}-betterleaves-${gameVersion}`;
  }
  if (presets.glowingOres && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves) {
    return `${loaderPrefix}-glowingores-${gameVersion}`;
  }
  if (presets.shaderFps || presets.embossedBlocks || presets.voiceChat || presets.fullbrightUb || presets.betterLeaves || presets.glowingOres) {
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
  if (current !== targetName || isCorruptShaderPackName(current) || (bundle.bundleVersion || 1) < SHADER_BUNDLE_VERSION) {
    writeBundle(modsDir, {
      ...bundle,
      bundleVersion: SHADER_BUNDLE_VERSION,
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
  };
}

function fullbrightNeedsPolytone(p) {
  return !!(p.fullbrightUb && p.shaderFps && !p.optifine);
}

function betterLeavesNeedsCullLeaves(p) {
  return !!(p.betterLeaves && !p.optifine && (p.shaderFps || p.embossedBlocks));
}

function glowingOresNeedsContinuity(p) {
  return !!(p.glowingOres && !p.optifine && !p.embossedBlocks);
}

function modrinthSlugsForPresets(p) {
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
  if (fullbrightNeedsPolytone(p)) add(POLYTONE_SLUG);
  if (betterLeavesNeedsCullLeaves(p)) add(CULL_LEAVES_SLUG);
  if (glowingOresNeedsContinuity(p)) add(CONTINUITY_SLUG);
  return out;
}

// OptiFine modpack'i Continuity gibi opsiyonel modları `*.jar.disabled` olarak
// getiriyor. Kullanıcı "kabartma" preset'ini de seçtiyse bu modları etkinleştir.
const OPTIFINE_EMBOSSED_MOD_PREFIXES = Object.freeze(['continuity']);

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
  const p = normalizePresets(presets);
  const files = modResourcePackFilenamesForPresets(p);
  const needContinuity = continuityResourcePacksNeeded(p);
  if (files.length === 0 && !needContinuity) return;

  for (const localName of files) {
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
  }

  const optionsPath = path.join(gameRoot, 'options.txt');
  const preserved = readPreservedUserResourcePacks(optionsPath);
  const entries = ['vanilla'];
  if (needContinuity) {
    for (const pack of CONTINUITY_PACKS) {
      if (!entries.includes(pack)) entries.push(pack);
    }
  }
  for (const localName of files) {
    const entry = `file/${localName}`;
    if (!entries.includes(entry)) entries.push(entry);
  }
  for (const entry of preserved) {
    if (!entries.includes(entry)) entries.push(entry);
  }
  writeResourcePacksLine(optionsPath, entries);
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

function presetsMatch(saved, wanted) {
  if (
    !saved ||
    typeof saved.shaderFps !== 'boolean' ||
    typeof saved.embossedBlocks !== 'boolean' ||
    typeof saved.optifine !== 'boolean' ||
    typeof saved.voiceChat !== 'boolean' ||
    typeof saved.fullbrightUb !== 'boolean' ||
    typeof saved.betterLeaves !== 'boolean' ||
    typeof saved.glowingOres !== 'boolean'
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
    saved.glowingOres === wanted.glowingOres
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

function createShaderStackService({ httpClient, fabricInstaller, modrinthClient, mrpackInstaller }) {
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
      (existing.shaderpacks || []).some((name) => /§/.test(String(name)))
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
    const m = String(v).match(/^(\d+\.\d+)$/);
    if (m) return [v, `${v}.1`];
    return [v];
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
    await fs.promises.mkdir(modsDir, { recursive: true });
    const jars = [];
    const downloadedVersionIds = new Set();
    const downloadedProjectIds = new Set();

    async function findContemporaryVersion(projectId, anchorPublishedIso, { strictPatch = false } = {}) {
      const anchorTs = Date.parse(anchorPublishedIso || '') || Date.now();
      const strictList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
        gameVersions: expandGameVersion(gameVersion),
      });
      const strictPick = pickNewestModrinthVersion(strictList, {
        anchorTs,
        gameVersion,
        strictPatch,
      });
      if (strictPick) return strictPick;

      if (/^\d+\.\d+\.\d+$/.test(String(gameVersion))) {
        return null;
      }

      const looseList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
      });
      return pickNewestModrinthVersion(looseList, { anchorTs, gameVersion, strictPatch: false });
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
          if (depVersion && !versionMatchesGamePatch(depVersion, gameVersion) && dep.project_id) {
            const override = await findContemporaryVersion(dep.project_id, version.date_published, {
              strictPatch: true,
            });
            if (override) depVersion = override;
          }
        } else if (dep.project_id) {
          depVersion = await findContemporaryVersion(dep.project_id, version.date_published);
        }
        if (depVersion) await persistVersion(depVersion);
      }
    }

    for (const slug of slugs) {
      let version;
      try {
        const versions = await modrinthClient.listProjectVersions(slug, {
          loaders: loaderFilter,
          gameVersions: expandGameVersion(gameVersion),
        });
        version = pickNewestModrinthVersion(versions, { gameVersion, strictPatch: false });
        if (!version) {
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Modrinth: "${slug}" için uygun sürüm bulunamadı.`
          );
        }
      } catch (err) {
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
    const expanded = (function expand(v) {
      const m = String(v).match(/^(\d+\.\d+)$/);
      return m ? [v, `${v}.1`] : [v];
    })(gameVersion);
    const queryAttempts = [{ gameVersions: expanded }, {}];
    let lastErr = null;
    for (const query of queryAttempts) {
      try {
        const file = await modrinthClient.latestPrimaryFile(slug, query);
        await fs.promises.mkdir(resourcepacksDir, { recursive: true });
        await httpClient.download(file.url, path.join(resourcepacksDir, localName));
        ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
        if (onNotice) onNotice(`${label} hazır: ${localName}`);
        return [localName];
      } catch (err) {
        lastErr = err;
        if (!isModrinthNotFound(err)) break;
      }
    }
    throw lastErr || new LauncherError(
      Codes.MODRINTH_NOT_FOUND,
      `${label} bu Minecraft sürümü (${gameVersion}) için Modrinth'te bulunamadı.`
    );
  }

  async function downloadGlowingOresResourcePack({ resourcepacksDir, gameVersion, onNotice, useContinuity = true }) {
    const expanded = (function expand(v) {
      const m = String(v).match(/^(\d+\.\d+)$/);
      return m ? [v, `${v}.1`] : [v];
    })(gameVersion);

    let versions = await modrinthClient.listProjectVersions(GLOWING_ORES_SLUG, { gameVersions: expanded });
    if (!versions.length) {
      versions = await modrinthClient.listProjectVersions(GLOWING_ORES_SLUG, {});
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

    if (includeShader && !includeOptifine && (loader === 'fabric' || loader === 'quilt')) {
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
    if (!includeOptifine && (includeShader || includeEmbossed) && ['fabric', 'quilt', 'forge', 'neoforge'].includes(modLoader)) {
      status('Better Leaves performansı için Cull Leaves indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CULL_LEAVES_SLUG],
          modrinthLoaders: [modLoader],
        });
      } catch {
        status('Cull Leaves bulunamadı — OptiFine Smart Leaves veya vanilla yapraklar kullanılabilir.');
      }
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

  async function ensure({ gameRoot, gameVersion, emit, modPresets, shaderSlug, fabricChannel = 'stable' }) {
    const presets = normalizePresets(modPresets);
    if (!presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres) {
      throw new Error('shaderStackService.ensure: en az bir mod önayarı gerekli');
    }

    const loaderPrefix = fabricChannel === 'beta' ? 'marsana-fabric-beta' : 'marsana';
    const resolvedShaderSlug = resolveShaderSlug(shaderSlug);
    const status = statusEmitter(emit);
    const customId = customIdFor(gameVersion, presets, resolvedShaderSlug, { loaderPrefix });
    const versionDir = path.join(gameRoot, 'versions', customId);
    const modsDir = path.join(gameRoot, 'mods');
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const versionJsonPath = path.join(versionDir, `${customId}.json`);
    const readyPath = path.join(versionDir, READY_FILE);

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
      if (presets.shaderFps && !presets.optifine && cached.shaderpacks[0]) {
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: cached.shaderpacks[0] });
      }
      applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir });
      status(`Mod profili (önbellek): ${resolvedShaderSlug} shader hazır, başlatılıyor...`);
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

    let optifineMeta = null;
    if (presets.optifine) {
      optifineMeta = await mrpackInstaller.installFromProject({
        projectSlug: OPTIFINE_PROJECT,
        gameVersion,
        gameRoot,
        emit,
      });
    }

    const slugs = modrinthSlugsForPresets(presets);
    let jars = slugs.length ? await downloadModsFromSlugs({ modsDir, gameVersion, slugs }) : [];
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
      status(
        `${packLabel} kuruldu. Video ayarları ve shader seçenekleri paket içindeki modlarla gelir; ` +
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
        fullbrightNeedsPolytone(presets)
          ? 'Fullbright UB kuruldu. Kaynak paketi etkinleştirildi; Sodium/Iris ile PolyTone da yüklendi.'
          : 'Fullbright UB kuruldu. Kaynak paketi indirildi ve Seçenekler → Kaynak paketleri bölümünde etkinleştirildi.'
      );
    } else if (presets.betterLeaves) {
      status(
        betterLeavesNeedsCullLeaves(presets)
          ? "Motschen's Better Leaves kuruldu. Kaynak paketi etkinleştirildi; Sodium/Embeddium ile Cull Leaves da yüklendi."
          : "Motschen's Better Leaves kuruldu. Kaynak paketi indirildi; OptiFine kullanıyorsanız Smart Leaves'i açın."
      );
    } else if (presets.glowingOres) {
      const borderPack = glowingOresUseContinuityPack({ presets });
      status(
        borderPack
          ? 'New Glowing Ores (Border) kuruldu. Continuity ile parıltı ve bağlı çerçeve etkin.'
          : 'New Glowing Ores (Default) kuruldu. OptiFine kullanıyorsanız Emissive Textures açın.'
      );
    } else {
      status('Kabartmalı blok / bağlı doku: Continuity + Sodium hazır.');
    }

    return { customId, assetIndexId };
  }

  return { ensure, applyModResourcePackPresets, installShadersForExternalLoader, installEmbossedForExternalLoader, installVoiceChatForExternalLoader, installFullbrightForExternalLoader, installBetterLeavesForExternalLoader, installGlowingOresForExternalLoader };
}

module.exports = { createShaderStackService };
