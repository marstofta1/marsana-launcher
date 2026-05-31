'use strict';

const fs = require('fs');
const path = require('path');

const PROTECTED_JAR_PREFIXES = Object.freeze(['marsana-client', 'cloth-config']);

function isMc26GameVersion(gameVersion) {
  return /^26\./.test(String(gameVersion || '').trim());
}

/** Dosya adindan 26.x disi (1.21/1.20 vb.) mod jar'i mi? */
function isJarFilenameIncompatibleWithGame(filename, gameVersion) {
  if (!isMc26GameVersion(gameVersion)) return false;
  const base = String(filename).replace(/\.jar\.disabled$/i, '').replace(/\.jar$/i, '');
  const lower = base.toLowerCase();
  if (PROTECTED_JAR_PREFIXES.some((p) => lower.startsWith(p))) return false;
  if (/26\.1|mc26\.|\+26\.|_26\.|-26\./i.test(lower)) return false;
  if (/fabric-api.*26\.1/i.test(lower)) return false;
  if (/\b1\.21\.|\b1\.20\.|\b1\.19\.|\b1\.18\.|\b1\.17\./i.test(lower)) return true;
  if (/\+1\.21|_1\.21|-1\.21|mc1\.21/i.test(lower)) return true;
  return false;
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

/** 26.x'te yanlis MC surumlu jar'lari ve fazla fabric-api kopyalarini temizle. */
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

  const fabricApiKept = dedupeFabricApiJars(modsDir, gameVersion);
  return { removed, fabricApiKept };
}

function dedupeFabricApiJars(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) return null;
  const entries = fs.readdirSync(modsDir).filter(
    (f) => /^fabric-api/i.test(f) && (f.endsWith('.jar') || f.endsWith('.jar.disabled'))
  );
  if (entries.length <= 1) return entries[0] || null;

  const score = (name) => {
    const lower = name.toLowerCase();
    if (/26\.1/i.test(lower)) return 1000;
    if (/1\.21/i.test(lower)) return 100;
    if (/1\.20/i.test(lower)) return 10;
    return 0;
  };

  const sorted = entries.slice().sort((a, b) => score(b) - score(a));
  const keep = sorted[0];
  for (const entry of entries) {
    if (entry === keep) continue;
    removeIfExists(path.join(modsDir, entry));
  }
  return keep;
}

module.exports = {
  isMc26GameVersion,
  isJarFilenameIncompatibleWithGame,
  purgeIncompatibleModJars,
  dedupeFabricApiJars,
};
