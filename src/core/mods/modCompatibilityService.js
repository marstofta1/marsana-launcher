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
  return /mc26\.|\+mc26|mc26\.1|\b26\.1|\+26\.|_26\.|-26\./i.test(lower);
}

function isActiveJarEntry(entry) {
  return (
    (entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) &&
    !entry.includes('.marsana-stashed-')
  );
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
    if (m && m[1]) return m[1];
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
  if (/^26\./.test(gv) && hasMc26Tag(jarBaseName(filename))) return true;
  if (/^\d+\.\d+\.\d+$/.test(gv) && /^\d+\.\d+\.\d+$/.test(tag)) {
    const gvBase = gv.match(/^(\d+\.\d+)\./)?.[1];
    const tagBase = tag.match(/^(\d+\.\d+)\./)?.[1];
    if (gvBase && tagBase && gvBase === tagBase) return false;
  }
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

function isWrongMc26ClientOrCloth(lower, gv) {
  if (isMc26GameVersion(gv)) {
    if (/^marsana-client/i.test(lower) || /^cloth-config/i.test(lower)) {
      return !hasMc26Tag(lower) && !/26\.1/i.test(lower);
    }
    return false;
  }
  if (/^marsana-client/i.test(lower) && (hasMc26Tag(lower) || /26\.1/i.test(lower))) return true;
  if (/^cloth-config/i.test(lower) && (hasMc26Tag(lower) || /26\.1/i.test(lower))) return true;
  return false;
}

/** Dosya adindan hedef MC surumu belli ama secilen surumle uyumsuz mu? */
function isJarFilenameIncompatibleWithGame(filename, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!gv) return false;
  const lower = jarBaseName(filename);

  if (isWrongMc26ClientOrCloth(lower, gv)) return true;

  if (isMc26GameVersion(gv)) {
    if (hasMc26Tag(lower)) return false;
    if (/fabric-api.*26\.1/i.test(lower)) return false;
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
  if (/^\d+\.\d+\.\d+$/.test(gv) && !/^26\./.test(gv)) {
    if (REQUIRES_EXACT_MC_TAG_ON_CLASSIC_PATCH.some((re) => re.test(lower))) {
      if (!tag || tag !== gv) return true;
    } else if (tag && compareSemver(tag, gv) > 0) {
      return true;
    }
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
  if (/26\.1|mc26/i.test(lower)) return 1000;
  const tag = parseJarMinecraftVersionTag(name);
  const gv = String(gameVersion || '').trim();
  if (tag && gv && tag === gv) return 900;
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

/** Yanlis MC surumlu yonetilen mod jar'larini ve fazla kopyalari temizle. */
function purgeIncompatibleModJars(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) {
    return { removed: 0, fabricApiKept: null };
  }

  let removed = 0;
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
