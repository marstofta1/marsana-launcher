'use strict';

const path = require('path');
const fs = require('fs');

const CONFIG_FILE = 'marsana-client.json';
const CONFIG_SCHEMA_VERSION = 1;
const MOD_JAR_PREFIX = 'marsana-client';

/** Launcher repo kökünden bundled mod jar dizini */
function bundledModsRoot(repoRoot) {
  return path.join(repoRoot, 'bundled-mods', 'marsana-client');
}

/** Oyun sürümüne göre hangi bundled jar satırı kullanılacak */
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
  const exact = path.join(bundledModsRoot(repoRoot), `marsana-client-${line}.jar`);
  if (fs.existsSync(exact)) return exact;
  const fallback = path.join(bundledModsRoot(repoRoot), 'marsana-client-26.1.jar');
  return fs.existsSync(fallback) ? fallback : null;
}

function configPath(gameRoot) {
  return path.join(gameRoot, 'config', CONFIG_FILE);
}

function readConfig(gameRoot) {
  const file = configPath(gameRoot);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeConfig(gameRoot, { cosmetic, modStates } = {}) {
  const dir = path.join(gameRoot, 'config');
  fs.mkdirSync(dir, { recursive: true });
  const existing = readConfig(gameRoot) || {};
  const payload = {
    version: CONFIG_SCHEMA_VERSION,
    cosmetic: cosmetic != null ? cosmetic : (existing.cosmetic || 'none'),
    modStates: {
      ...(existing.modStates && typeof existing.modStates === 'object' ? existing.modStates : {}),
      ...(modStates && typeof modStates === 'object' ? modStates : {}),
    },
  };
  fs.writeFileSync(configPath(gameRoot), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function installBundledMod({ repoRoot, modsDir, gameVersion, onNotice }) {
  const src = bundledJarPath(repoRoot, gameVersion);
  if (!src) {
    if (onNotice) {
      onNotice(
        'Marsana Client oyun modu bulunamadi — marsana-client-mod Gradle build gerekli (bundled-mods/marsana-client/).'
      );
    }
    return null;
  }
  fs.mkdirSync(modsDir, { recursive: true });
  const destName = path.basename(src);
  const dest = path.join(modsDir, destName);
  fs.copyFileSync(src, dest);
  if (onNotice) onNotice(`Marsana Client oyun modu kuruldu (${destName}).`);
  return destName;
}

/** Launcher indirdigi mod jar'larina config'teki acik/kapali durumunu uygula */
function applyModToggleStates(modsDir, config) {
  if (!config || !config.modStates || !fs.existsSync(modsDir)) return;
  for (const [fileName, enabled] of Object.entries(config.modStates)) {
    if (typeof enabled !== 'boolean') continue;
    if (fileName.startsWith(MOD_JAR_PREFIX)) continue;
    const enabledPath = path.join(modsDir, fileName);
    const disabledPath = path.join(modsDir, `${fileName}.disabled`);
    try {
      if (enabled) {
        if (fs.existsSync(disabledPath) && !fs.existsSync(enabledPath)) {
          fs.renameSync(disabledPath, enabledPath);
        }
      } else if (fs.existsSync(enabledPath)) {
        fs.renameSync(enabledPath, disabledPath);
      }
    } catch {
      /* best effort */
    }
  }
}

function isMarsanaClientJar(name) {
  return String(name || '').toLowerCase().startsWith(MOD_JAR_PREFIX) && name.endsWith('.jar');
}

module.exports = {
  CONFIG_FILE,
  bundledModsRoot,
  modLineForGameVersion,
  bundledJarPath,
  configPath,
  readConfig,
  writeConfig,
  installBundledMod,
  applyModToggleStates,
  isMarsanaClientJar,
};
