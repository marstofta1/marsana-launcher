'use strict';

const fs = require('fs');
const path = require('path');

const PROTECTED_JAR_PREFIXES = Object.freeze(['marsana-client', 'cloth-config']);

/** Dedupe aileleri — sodium-extra, sodium-\d ile karistirilmaz. */
const MOD_DEDUPE_FAMILIES = Object.freeze([
  { id: 'fabric-api', test: (name) => /^fabric-api/i.test(name) },
  { id: 'iris', test: (name) => /^iris-\d/i.test(name) },
  { id: 'sodium', test: (name) => /^sodium-\d/i.test(name) },
  { id: 'oculus', test: (name) => /^oculus-/i.test(name) },
  { id: 'rubidium', test: (name) => /^rubidium-/i.test(name) },
  { id: 'embeddium', test: (name) => /^embeddium-/i.test(name) },
  { id: 'continuity', test: (name) => /^continuity-/i.test(name) },
]);

const SHADER_CORE_WITHOUT_MC26 = Object.freeze([
  /^iris-\d/i,
  /^sodium-\d/i,
  /^oculus-/i,
  /^rubidium-/i,
  /^embeddium-/i,
  /^continuity-/i,
]);

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

/** Dosya adindan 26.x disi (1.21/1.20/mc1.20 vb.) mod jar'i mi? */
function isJarFilenameIncompatibleWithGame(filename, gameVersion) {
  if (!isMc26GameVersion(gameVersion)) return false;
  const lower = jarBaseName(filename);
  if (PROTECTED_JAR_PREFIXES.some((p) => lower.startsWith(p))) return false;
  if (hasMc26Tag(lower)) return false;
  if (/fabric-api.*26\.1/i.test(lower)) return false;

  if (/\+mc1\.|mc1\.(1[0-9]|20|21|22)/i.test(lower)) return true;
  if (/\+1\.(20|21)\.|_1\.(20|21)\./i.test(lower)) return true;
  if (/\b1\.21\.|\b1\.20\.|\b1\.19\.|\b1\.18\.|\b1\.17\./i.test(lower)) return true;

  if (SHADER_CORE_WITHOUT_MC26.some((re) => re.test(lower))) return true;

  return false;
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function mc26JarScore(name) {
  const lower = String(name).toLowerCase();
  if (/26\.1|mc26/i.test(lower)) return 1000;
  return 0;
}

function dedupeModFamily(modsDir, family) {
  const entries = fs.readdirSync(modsDir).filter(
    (f) => family.test(f) && (f.endsWith('.jar') || f.endsWith('.jar.disabled') || f.includes('.marsana-stashed-'))
  );
  if (entries.length <= 1) return null;

  const sorted = entries.slice().sort((a, b) => mc26JarScore(b) - mc26JarScore(a));
  const keep = sorted[0];
  if (mc26JarScore(keep) === 0) {
    for (const entry of entries) {
      if (!isJarFilenameIncompatibleWithGame(entry, '26.1.2')) continue;
      removeIfExists(path.join(modsDir, entry));
    }
    return null;
  }

  for (const entry of entries) {
    if (entry === keep) continue;
    removeIfExists(path.join(modsDir, entry));
  }
  return keep;
}

function dedupeFabricApiJars(modsDir) {
  if (!fs.existsSync(modsDir)) return null;
  const family = MOD_DEDUPE_FAMILIES.find((f) => f.id === 'fabric-api');
  return dedupeModFamily(modsDir, family);
}

function dedupeShaderStackMods(modsDir) {
  if (!fs.existsSync(modsDir)) return;
  for (const family of MOD_DEDUPE_FAMILIES) {
    if (family.id === 'fabric-api') continue;
    dedupeModFamily(modsDir, family);
  }
}

function coreSodiumJarPresent(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some((f) => /^sodium-\d/i.test(f) && isActiveJarEntry(f));
}

function coreIrisJarPresent(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some((f) => /^iris-\d/i.test(f) && isActiveJarEntry(f));
}

/** 26.x'te yanlis MC surumlu jar'lari ve fazla kopyalari temizle. */
function purgeIncompatibleModJars(modsDir, gameVersion) {
  if (!isMc26GameVersion(gameVersion) || !fs.existsSync(modsDir)) {
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

  dedupeShaderStackMods(modsDir);
  const fabricApiKept = dedupeFabricApiJars(modsDir);
  return { removed, fabricApiKept };
}

module.exports = {
  isMc26GameVersion,
  isJarFilenameIncompatibleWithGame,
  purgeIncompatibleModJars,
  dedupeFabricApiJars,
  dedupeShaderStackMods,
  coreSodiumJarPresent,
  coreIrisJarPresent,
};
