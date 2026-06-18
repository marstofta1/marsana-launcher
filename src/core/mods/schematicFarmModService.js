'use strict';

const path = require('path');
const fs = require('fs');

const MOD_JAR_PREFIX = 'marsana-schematic-farm';

function bundledModsRoot(repoRoot) {
  return path.join(repoRoot, 'bundled-mods', 'schematic-farm');
}

function modLineForGameVersion(gameVersion) {
  const id = String(gameVersion || '').trim();
  if (/^26\./.test(id)) return '26.1';
  if (/^1\.22/.test(id)) return '1.22';
  if (/^1\.21/.test(id)) return '1.21';
  return null;
}

function bundledJarPath(repoRoot, gameVersion) {
  const line = modLineForGameVersion(gameVersion);
  if (!line) return null;
  const exact = path.join(bundledModsRoot(repoRoot), `marsana-schematic-farm-${line}.jar`);
  if (fs.existsSync(exact)) return exact;
  return null;
}

function installBundledMod({ repoRoot, modsDir, gameVersion, onNotice }) {
  const src = bundledJarPath(repoRoot, gameVersion);
  if (!src) {
    if (onNotice) {
      onNotice(
        'Sematik Farm modu bulunamadi — marsana-schematic-farm-mod Gradle build gerekli (bundled-mods/schematic-farm/).'
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

module.exports = {
  bundledModsRoot,
  modLineForGameVersion,
  bundledJarPath,
  installBundledMod,
  isSchematicFarmJar,
  schematicFarmJarPresent,
  MOD_JAR_PREFIX,
};
