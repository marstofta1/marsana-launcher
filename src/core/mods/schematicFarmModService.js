'use strict';

const path = require('path');
const fs = require('fs');

const MOD_JAR_PREFIX = 'marsana-schematic-farm';

/** Launcher bundled jar satirlari — 1.20.x icin ayri build gerekir. */
const SCHEMATIC_BUNDLED_LINES = Object.freeze(['26.1', '1.22', '1.21', '1.20']);

function bundledModsRoot(repoRoot) {
  return path.join(repoRoot, 'bundled-mods', 'schematic-farm');
}

function modLineForGameVersion(gameVersion) {
  const id = String(gameVersion || '').trim();
  if (/^26\./.test(id)) return '26.1';
  if (/^1\.22/.test(id)) return '1.22';
  if (/^1\.21/.test(id)) return '1.21';
  if (/^1\.20/.test(id)) return '1.20';
  return null;
}

function jarPathForLine(repoRoot, line) {
  if (!line) return null;
  const exact = path.join(bundledModsRoot(repoRoot), `marsana-schematic-farm-${line}.jar`);
  return fs.existsSync(exact) ? exact : null;
}

function bundledJarPath(repoRoot, gameVersion) {
  const primary = modLineForGameVersion(gameVersion);
  if (primary) {
    const exact = jarPathForLine(repoRoot, primary);
    if (exact) return exact;
  }
  // 26.x: 26.1 satiri tum 26.x surumlerinde kullanilir
  if (/^26\./.test(String(gameVersion || ''))) {
    return jarPathForLine(repoRoot, '26.1');
  }
  return null;
}

function bundledJarAvailable(repoRoot, gameVersion) {
  return !!bundledJarPath(repoRoot, gameVersion);
}

function listAvailableLines(repoRoot) {
  const root = bundledModsRoot(repoRoot);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((f) => f.startsWith(MOD_JAR_PREFIX) && f.endsWith('.jar'))
    .map((f) => {
      const m = f.match(/marsana-schematic-farm-(.+)\.jar$/i);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

function schematicFarmSupportedForGameVersion(gameVersion) {
  const id = String(gameVersion || '').trim();
  if (!id) return false;
  if (/^26\./.test(id)) return true;
  const m = id.match(/^1\.(\d+)/);
  if (!m) return false;
  return parseInt(m[1], 10) >= 20;
}

function installBundledMod({ repoRoot, modsDir, gameVersion, onNotice }) {
  const src = bundledJarPath(repoRoot, gameVersion);
  if (!src) {
    const line = modLineForGameVersion(gameVersion);
    if (onNotice) {
      onNotice(
        line
          ? `Sematik Farm modu (${line} satiri) bulunamadi — npm run build:schematic-farm-mod`
          : 'Sematik Farm bu Minecraft surumunde desteklenmiyor (1.20 – 26.2 araligi).'
      );
    }
    return null;
  }
  fs.mkdirSync(modsDir, { recursive: true });
  const destName = path.basename(src);
  const dest = path.join(modsDir, destName);
  fs.copyFileSync(src, dest);
  if (onNotice) onNotice(`Sematik Farm modu kuruldu (${destName}).`);
  return destName;
}

function isSchematicFarmJar(name) {
  return String(name || '').toLowerCase().startsWith(MOD_JAR_PREFIX) && name.endsWith('.jar');
}

function schematicFarmJarPresent(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some(
    (f) => isSchematicFarmJar(f) && !f.endsWith('.jar.disabled')
  );
}

/** Sematik Farm kapaliysa eski jar'lari mods klasorunden kaldir (Fabric yuklemesin). */
function removeSchematicFarmJars(modsDir) {
  if (!modsDir || !fs.existsSync(modsDir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(modsDir)) {
    if (!isSchematicFarmJar(entry.replace(/\.disabled$/i, ''))) continue;
    try {
      fs.unlinkSync(path.join(modsDir, entry));
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

module.exports = {
  bundledModsRoot,
  modLineForGameVersion,
  bundledJarPath,
  bundledJarAvailable,
  listAvailableLines,
  schematicFarmSupportedForGameVersion,
  installBundledMod,
  isSchematicFarmJar,
  schematicFarmJarPresent,
  removeSchematicFarmJars,
  MOD_JAR_PREFIX,
  SCHEMATIC_BUNDLED_LINES,
};
