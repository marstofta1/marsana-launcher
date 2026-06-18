'use strict';

const fs = require('fs');
const path = require('path');

const PROTECTED_JAR_PREFIXES = Object.freeze([]);

/** 1.21.x patch surumlerinde MC etiketi olmadan veya yanlis etiketle kurulmamali. */
const REQUIRES_EXACT_MC_TAG_ON_CLASSIC_PATCH = Object.freeze([
  /^modmenu/i,
  /^cloth-config/i,
  /^sodiumextrainformation/i,
  /^sodium-extra-information/i,
]);

/** Dedupe aileleri — sodium-extra, sodium-\d ile karistirilmaz. */
const MOD_DEDUPE_FAMILIES = Object.freeze([
  { id: 'fabric-api', test: (name) => /^fabric-api/i.test(name) },
  { id: 'iris', test: (name) => /^iris-fabric-/i.test(name) },
  { id: 'sodium', test: (name) => /^sodium-fabric-/i.test(name) },
  { id: 'oculus', test: (name) => /^oculus-/i.test(name) },
  { id: 'rubidium', test: (name) => /^rubidium-/i.test(name) },
  { id: 'embeddium', test: (name) => /^embeddium-/i.test(name) },
  { id: 'continuity', test: (name) => /^continuity-/i.test(name) },
  { id: 'cullleaves', test: (name) => /^cullleaves-/i.test(name) },
  { id: 'krypton', test: (name) => /^krypton-/i.test(name) },
  { id: 'lithium', test: (name) => /^lithium-fabric-/i.test(name) },
  { id: 'ferritecore', test: (name) => /^ferritecore-/i.test(name) },
  { id: 'immediatelyfast', test: (name) => /^immediatelyfast/i.test(name) },
]);

/** OptiFine paketinin eski surumle getirdigi, MC etiketi olmayan jar'lar. */
const KNOWN_STALE_MOD_JARS = Object.freeze([
  { test: /^krypton-0\.2\.9$/i, minGame: '1.21.10' },
  { test: /^continuity-3\.0\.1-beta\.1\+1\.21\.6$/i, minGame: '1.21.10' },
]);

const SHADER_CORE_WITHOUT_MC26 = Object.freeze([
  /^iris-fabric-/i,
  /^sodium-fabric-/i,
  /^oculus-/i,
  /^rubidium-/i,
  /^embeddium-/i,
  /^continuity-/i,
]);

/** 26.x ile uyumsuz klasik-surum modlari (dosya adinda MC etiketi olmasa bile). */
const MC26_CLASSIC_ONLY_MOD_PREFIXES = Object.freeze([
  /^viafabricplus/i,
  /^via-fabric-plus/i,
]);

/** Sodium 0.8+ (mc26) en az bu SSPB surumunu ister; eski jar cakismasi olusturur. */
const MC26_MIN_SSPB_VERSION = '6.0.0';

function isMc26GameVersion(gameVersion) {
  return /^26\./.test(String(gameVersion || '').trim());
}

function jarBaseName(filename) {
  return String(filename)
    .replace(/\.marsana-stashed-[^.]+$/i, '')
    .replace(/\.jar\.disabled$/i, '')
    .replace(/\.jar$/i, '')
    .toLowerCase();
}

function hasMc26Tag(lower) {
  return /(?:^|[^0-9])26\.\d+(?:\.\d+)?(?:\b|[+._-]|$)/i.test(lower) || /\+mc26\./i.test(lower);
}

function mc26MinorOf(version) {
  const m = String(version || '').match(/^26\.(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Launcher bundled Marsana mod jar'lari (marsana-client-26.1.jar vb.). */
function isMarsanaBundledModJar(filename) {
  return /^marsana-(client|schematic-farm)/i.test(jarBaseName(filename));
}

function marsanaBundledMc26LineTag(filename) {
  const m = jarBaseName(filename).match(/marsana-(?:client|schematic-farm)-(\d+\.\d+)/i);
  return m ? m[1] : null;
}

/** 26.1 satiri jar 26.2+ oyununda calisir; daha eski oyunda reddedilir. null = bu kural uygulanmaz. */
function marsanaBundledCompatibleWithGame(filename, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!isMarsanaBundledModJar(filename) || !/^26\./.test(gv)) return null;
  const line = marsanaBundledMc26LineTag(filename);
  if (!line || !/^26\./.test(line)) return true;
  const gvMinor = mc26MinorOf(gv);
  const lineMinor = mc26MinorOf(line);
  if (gvMinor == null || lineMinor == null) return true;
  return gvMinor >= lineMinor;
}

function mc26VersionsCompatible(tag, gameVersion) {
  const gv = String(gameVersion || '').trim();
  const tv = String(tag || '').trim();
  if (!/^26\./.test(gv) || !/^26\./.test(tv)) return false;
  const gvMinor = mc26MinorOf(gv);
  const tvMinor = mc26MinorOf(tv);
  if (gvMinor == null || tvMinor == null || gvMinor !== tvMinor) return false;
  const gvPatch = gv.match(/^26\.\d+\.(\d+)$/)?.[1];
  const tvPatch = tv.match(/^26\.\d+\.(\d+)$/)?.[1];
  if (!gvPatch) return true;
  if (!tvPatch) return true;
  return compareSemver(tv, gv) <= 0;
}

/** OptiFine / yeni MC paketinden kalan, dosya adinda MC etiketi olmayan modlar. */
const RECENT_ONLY_MOD_FAMILIES = Object.freeze([
  { test: /^bactromod/i, minGame: '1.21.10' },
  { test: /^serverpingerfixer/i, minGame: '1.20.5' },
  { test: /^scalablelux/i, minGame: '1.21.2' },
  { test: /^rrls-/i, minGame: '1.20.1' },
  { test: /^mod-loading-screen/i, minGame: '1.20.1' },
  { test: /^entity[-_]?model[-_]?features/i, minGame: '1.20.1' },
  { test: /^entity[-_]?texture[-_]?features/i, minGame: '1.20.1' },
  { test: /^languagereload/i, minGame: '1.20.1' },
  { test: /^forgeconfigapiport/i, minGame: '1.20.1' },
  { test: /^fzzy[-_]?config/i, minGame: '1.20.1' },
  { test: /^libjf/i, minGame: '1.20.1' },
  { test: /^c2me-/i, minGame: '1.20.1' },
]);

function isClassicOneDotGameVersion(gameVersion) {
  return /^1\.\d+(\.\d+)?$/.test(String(gameVersion || '').trim());
}

function isRecentOnlyModForClassicGame(lower, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!isClassicOneDotGameVersion(gv)) return false;
  return RECENT_ONLY_MOD_FAMILIES.some(
    (entry) => entry.test.test(lower) && compareSemver(gv, entry.minGame) < 0
  );
}

function isActiveJarEntry(entry) {
  return (
    (entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) &&
    !entry.includes('.marsana-stashed-')
  );
}

/** Mod semver (16.0.1, 20.0.149) ile MC surumunu ayir. */
function isPlausibleMcVersionTag(tag) {
  const t = String(tag || '').trim();
  if (!t) return false;
  if (/^26\.\d+(?:\.\d+)?$/.test(t)) return true;
  const m = t.match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const minor = parseInt(m[1], 10);
  return minor >= 6 && minor <= 30;
}

function classicMcMinorBase(version) {
  const m = String(version || '').match(/^(1\.\d+)\./);
  return m ? m[1] : null;
}

/** Jar adindaki Minecraft surum etiketi (+1.21.10, +mc1.21.9 vb.) */
function parseJarMinecraftVersionTag(filename) {
  const lower = jarBaseName(filename);
  const patterns = [
    /\+mc(\d+\.\d+(?:\.\d+)?)/i,
    /\+(\d+\.\d+\.\d+)/,
    /(?:^|[^0-9])mc(\d+\.\d+(?:\.\d+)?)/i,
    /_(\d+\.\d+\.\d+)/,
    /-(\d+\.\d+\.\d+)(?:-|$)/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m && m[1] && isPlausibleMcVersionTag(m[1])) return m[1];
  }
  return null;
}

function gameVersionMatchCandidates(gameVersion) {
  const id = String(gameVersion || '').trim();
  const candidates = new Set([id]);
  const patch = id.match(/^(\d+\.\d+)\.(\d+)$/);
  if (patch) candidates.add(patch[1]);
  const m26 = id.match(/^26\.(\d+)(?:\.(\d+))?$/);
  if (m26) {
    if (m26[2]) candidates.add(`26.${m26[1]}`);
  }
  return [...candidates];
}

function parseModSemverFromJar(filename) {
  const base = jarBaseName(filename);
  const m = base.match(/(?:^|[+-])(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function compareSemver(a, b) {
  const pa = String(a || '').split('.').map(Number);
  const pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function isKnownStaleModJar(filename, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!gv) return false;
  const base = jarBaseName(filename);
  return KNOWN_STALE_MOD_JARS.some(
    (entry) => entry.test.test(base) && compareSemver(gv, entry.minGame) >= 0
  );
}

function jarVersionMatchesGame(filename, gameVersion) {
  const tag = parseJarMinecraftVersionTag(filename);
  if (!tag) return true;
  const gv = String(gameVersion || '').trim();
  if (!gv) return true;
  if (tag === gv) return true;
  const candidates = gameVersionMatchCandidates(gv);
  if (candidates.includes(tag)) return true;
  if (/^26\./.test(gv) && /^26\./.test(tag)) {
    return mc26VersionsCompatible(tag, gv);
  }
  if (/^\d+\.\d+\.\d+$/.test(gv) && /^\d+\.\d+\.\d+$/.test(tag)) {
    const gvBase = gv.match(/^(\d+\.\d+)\./)?.[1];
    const tagBase = tag.match(/^(\d+\.\d+)\./)?.[1];
    if (gvBase && tagBase && gvBase === tagBase) return false;
  }
  return false;
}

function isPlatformIncompatibleModJar(filename) {
  const lower = jarBaseName(filename);
  if (process.platform === 'darwin') return false;
  if (/macos/i.test(lower) && /input/i.test(lower)) return true;
  return false;
}

function isManagedModFamilyJar(filename) {
  return MOD_DEDUPE_FAMILIES.some((f) => f.test(filename));
}

function isMc26StaleSspbJar(filename) {
  const lower = jarBaseName(filename);
  if (!/^sodium-shadowy-path-blocks/i.test(lower)) return false;
  const semver = parseModSemverFromJar(filename);
  if (!semver) return true;
  return compareSemver(semver, MC26_MIN_SSPB_VERSION) < 0;
}

function isWrongMc26ClientOrCloth(filename, gv) {
  const lower = jarBaseName(filename);
  const isClientOrCloth = /^marsana-client/i.test(lower) || /^marsana-schematic-farm/i.test(lower) || /^cloth-config/i.test(lower);
  if (!isClientOrCloth) return false;

  const marsanaOk = marsanaBundledCompatibleWithGame(filename, gv);
  if (marsanaOk !== null) return !marsanaOk;

  if (isMc26GameVersion(gv)) {
    const tag = parseJarMinecraftVersionTag(filename);
    if (tag && /^26\./.test(tag)) {
      return !mc26VersionsCompatible(tag, gv);
    }
    const minor = mc26MinorOf(gv);
    if (minor != null && new RegExp(`(?:^|[^0-9])26\\.${minor}(?:\\.|\\b|[+_-])`).test(lower)) {
      return false;
    }
    return true;
  }

  if (hasMc26Tag(lower) || /26\.\d/i.test(lower)) return true;
  return false;
}

/** Dosya adindan hedef MC surumu belli ama secilen surumle uyumsuz mu? */
function isJarFilenameIncompatibleWithGame(filename, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!gv) return false;
  const lower = jarBaseName(filename);

  if (isWrongMc26ClientOrCloth(filename, gv)) return true;
  if (isPlatformIncompatibleModJar(filename)) return true;

  const marsanaOk = marsanaBundledCompatibleWithGame(filename, gv);
  if (marsanaOk !== null) return !marsanaOk;

  if (isMc26GameVersion(gv)) {
    const tag = parseJarMinecraftVersionTag(filename);
    if (tag) {
      if (/^26\./.test(tag)) return !mc26VersionsCompatible(tag, gv);
      return true;
    }
    if (/fabric-api.*26\./i.test(lower) && new RegExp(`26\\.${mc26MinorOf(gv)}`).test(lower)) {
      return false;
    }
    if (MC26_CLASSIC_ONLY_MOD_PREFIXES.some((re) => re.test(lower))) return true;
    if (isMc26StaleSspbJar(filename)) return true;
    if (/\+mc1\.|mc1\.(1[0-9]|20|21|22)/i.test(lower)) return true;
    if (/\+1\.(20|21)\.|_1\.(20|21)\./i.test(lower)) return true;
    if (/\b1\.21\.|\b1\.20\.|\b1\.19\.|\b1\.18\.|\b1\.17\./i.test(lower)) return true;
    if (SHADER_CORE_WITHOUT_MC26.some((re) => re.test(lower))) return true;
    return false;
  }

  if (isKnownStaleModJar(filename, gv)) return true;

  const tag = parseJarMinecraftVersionTag(filename);

  if (isClassicOneDotGameVersion(gv)) {
    if (hasMc26Tag(lower)) return true;
    if (tag && /^26\./.test(tag)) return true;
    if (tag && /^\d+\.\d+\.\d+$/.test(gv) && compareSemver(tag, gv) > 0) return true;
    if (isRecentOnlyModForClassicGame(lower, gv)) return true;
  }

  if (/^\d+\.\d+\.\d+$/.test(gv) && !/^26\./.test(gv)) {
    if (REQUIRES_EXACT_MC_TAG_ON_CLASSIC_PATCH.some((re) => re.test(lower))) {
      if (!tag) return false;
      if (tag === gv) return false;
      const gvBase = classicMcMinorBase(gv);
      const tagBase = classicMcMinorBase(tag);
      // Modrinth bazen 1.21.10 icin yalnizca +1.21.9 etiketli jar listeler (modmenu, cloth-config).
      if (gvBase && tagBase && gvBase === tagBase && compareSemver(tag, gv) <= 0) return false;
      return true;
    }
    if (tag && compareSemver(tag, gv) > 0) return true;
  }

  if (!isManagedModFamilyJar(filename)) return false;
  return !jarVersionMatchesGame(filename, gv);
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function jarCompatibilityScore(name, gameVersion) {
  const lower = String(name).toLowerCase();
  const gv = String(gameVersion || '').trim();
  const tag = parseJarMinecraftVersionTag(name);
  if (tag && gv && tag === gv) return 1000;
  if (tag && gv && /^26\./.test(gv) && mc26VersionsCompatible(tag, gv)) return 950;
  if (/^26\./.test(gv)) {
    const minor = mc26MinorOf(gv);
    if (minor != null && new RegExp(`26\\.${minor}`).test(lower)) return 900;
  }
  if (tag && gameVersionMatchCandidates(gv).includes(tag)) return 700;
  if (tag && gv && tag.startsWith(`${gv.split('.').slice(0, 2).join('.')}.`)) return 200;
  const semver = parseModSemverFromJar(name);
  if (semver) {
    const parts = semver.split('.').map(Number);
    return 50 + (parts[0] || 0) * 1_000_000 + (parts[1] || 0) * 1_000 + (parts[2] || 0);
  }
  return 0;
}

function dedupeModFamily(modsDir, family, gameVersion) {
  const entries = fs.readdirSync(modsDir).filter(
    (f) => family.test(f) && (f.endsWith('.jar') || f.endsWith('.jar.disabled') || f.includes('.marsana-stashed-'))
  );
  if (entries.length <= 1) return null;

  const sorted = entries.slice().sort(
    (a, b) => jarCompatibilityScore(b, gameVersion) - jarCompatibilityScore(a, gameVersion)
  );
  const keep = sorted[0];
  for (const entry of entries) {
    if (entry === keep) continue;
    if (isJarFilenameIncompatibleWithGame(entry, gameVersion)) {
      removeIfExists(path.join(modsDir, entry));
      continue;
    }
    if (jarCompatibilityScore(entry, gameVersion) < jarCompatibilityScore(keep, gameVersion)) {
      removeIfExists(path.join(modsDir, entry));
    }
  }
  return keep;
}

function dedupeFabricApiJars(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) return null;
  const family = MOD_DEDUPE_FAMILIES.find((f) => f.id === 'fabric-api');
  return dedupeModFamily(modsDir, family, gameVersion);
}

function dedupeShaderStackMods(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) return;
  for (const family of MOD_DEDUPE_FAMILIES) {
    if (family.id === 'fabric-api') continue;
    dedupeModFamily(modsDir, family, gameVersion);
  }
}

function familyJarPresent(modsDir, familyTest, gameVersion) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some(
    (f) => familyTest(f) && isActiveJarEntry(f) && jarVersionMatchesGame(f, gameVersion)
  );
}

function coreSodiumJarPresent(modsDir, gameVersion) {
  return familyJarPresent(modsDir, (f) => /^sodium-fabric-/i.test(f), gameVersion);
}

function coreIrisJarPresent(modsDir, gameVersion) {
  return familyJarPresent(modsDir, (f) => /^iris-fabric-/i.test(f), gameVersion);
}

function continuityJarPresent(modsDir, gameVersion) {
  return familyJarPresent(modsDir, (f) => /^continuity-/i.test(f), gameVersion);
}

function kryptonJarPresent(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some((f) => {
    if (!/^krypton-/i.test(f) || !isActiveJarEntry(f)) return false;
    if (isKnownStaleModJar(f, gameVersion)) return false;
    return true;
  });
}

function removeModFamilyJars(modsDir, familyTest) {
  if (!fs.existsSync(modsDir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(modsDir)) {
    if (!familyTest(entry)) continue;
    if (!entry.endsWith('.jar') && !entry.endsWith('.jar.disabled') && !entry.includes('.marsana-stashed-')) {
      continue;
    }
    removeIfExists(path.join(modsDir, entry));
    removed += 1;
  }
  return removed;
}

const BUNDLE_FILE = '.marsana-mod-bundle.json';

function purgeForeignGameVersionBundle(modsDir, gameVersion) {
  const bundlePath = path.join(modsDir, BUNDLE_FILE);
  if (!fs.existsSync(bundlePath)) return 0;
  let bundle;
  try {
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  } catch {
    return 0;
  }
  if (!bundle.gameVersion || bundle.gameVersion === gameVersion) return 0;

  let removed = 0;
  for (const jar of bundle.jars || []) {
    const target = path.join(modsDir, jar);
    if (fs.existsSync(target)) {
      removeIfExists(target);
      removed += 1;
    }
  }
  removeIfExists(bundlePath);
  removeIfExists(path.join(modsDir, '.marsana-shader-ready.json'));
  return removed;
}

/** Yanlis MC surumlu yonetilen mod jar'larini ve fazla kopyalari temizle. */
function purgeIncompatibleModJars(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) {
    return { removed: 0, fabricApiKept: null };
  }

  const gv = String(gameVersion || '').trim();
  let removed = purgeForeignGameVersionBundle(modsDir, gv);
  for (const entry of fs.readdirSync(modsDir)) {
    const isJar = entry.endsWith('.jar') || entry.endsWith('.jar.disabled');
    const isStash = entry.includes('.marsana-stashed-');
    if (!isJar && !isStash) continue;
    const jarName = entry.split('.marsana-stashed-')[0];
    if (!isJarFilenameIncompatibleWithGame(jarName, gameVersion)) continue;
    removeIfExists(path.join(modsDir, entry));
    removed += 1;
  }

  dedupeShaderStackMods(modsDir, gameVersion);
  const fabricApiKept = dedupeFabricApiJars(modsDir, gameVersion);
  return { removed, fabricApiKept };
}

module.exports = {
  isMc26GameVersion,
  mc26VersionsCompatible,
  isKnownStaleModJar,
  isJarFilenameIncompatibleWithGame,
  jarVersionMatchesGame,
  parseJarMinecraftVersionTag,
  parseModSemverFromJar,
  purgeIncompatibleModJars,
  dedupeFabricApiJars,
  dedupeShaderStackMods,
  removeModFamilyJars,
  coreSodiumJarPresent,
  coreIrisJarPresent,
  continuityJarPresent,
  kryptonJarPresent,
  isManagedModFamilyJar,
};
