'use strict';

const path = require('path');
const fs = require('fs');

const modCompatibilityService = require('./modCompatibilityService');

const CLOTH_CONFIG_BUNDLED = 'cloth-config-26.1.154.jar';

function bundledDepsRoot(repoRoot) {
  return path.join(repoRoot, 'bundled-mods', 'deps');
}

function clothConfigJarPresent(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some(
    (f) => /^cloth-config/i.test(f) && f.endsWith('.jar') && !f.endsWith('.jar.disabled')
  );
}

function fabricKotlinJarPresent(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some(
    (f) => /^fabric-language-kotlin/i.test(f) && f.endsWith('.jar') && !f.endsWith('.jar.disabled')
  );
}

function modmenuJarPresent(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some(
    (f) => /^modmenu/i.test(f) && f.endsWith('.jar') && !f.endsWith('.jar.disabled')
  );
}

/** Kotlin tabanli modlar kurulu ama fabric-language-kotlin yoksa true. */
const KOTLIN_DEPENDENT_JAR_PATTERNS = Object.freeze([
  /zoomify/i,
  /optigui/i,
  /particle.?core/i,
  /fzzy.?config/i,
  /^capes-\d/i,
]);

function activeModJarNames(modsDir) {
  if (!fs.existsSync(modsDir)) return [];
  return fs.readdirSync(modsDir).filter(
    (f) => f.endsWith('.jar') && !f.endsWith('.jar.disabled') && !f.includes('.marsana-stashed-')
  );
}

function kotlinRuntimeDepNeeded(modsDir) {
  if (fabricKotlinJarPresent(modsDir)) return false;
  return activeModJarNames(modsDir).some((name) =>
    KOTLIN_DEPENDENT_JAR_PATTERNS.some((re) => re.test(name))
  );
}

function modmenuRuntimeDepNeeded(modsDir) {
  if (modmenuJarPresent(modsDir)) return false;
  return activeModJarNames(modsDir).some((name) => /modlistmemory/i.test(name));
}

function fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack = false } = {}) {
  if (clientHudPack) return true;
  return kotlinRuntimeDepNeeded(modsDir) || modmenuRuntimeDepNeeded(modsDir);
}

function fabricHudRuntimeDepsOk(modsDir, { clientHudPack = false } = {}) {
  if (!fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack })) return true;
  const needKotlin = clientHudPack || kotlinRuntimeDepNeeded(modsDir);
  const needModmenu = clientHudPack || modmenuRuntimeDepNeeded(modsDir);
  if (needKotlin && !fabricKotlinJarPresent(modsDir)) return false;
  if (needModmenu && !modmenuJarPresent(modsDir)) return false;
  if (clientHudPack && !clothConfigJarPresent(modsDir)) return false;
  return true;
}

function reenableClothConfigJar(modsDir) {
  if (!fs.existsSync(modsDir)) return false;
  for (const entry of fs.readdirSync(modsDir)) {
    if (!/^cloth-config/i.test(entry) || !entry.endsWith('.jar.disabled')) continue;
    const from = path.join(modsDir, entry);
    const to = path.join(modsDir, entry.slice(0, -'.disabled'.length));
    try {
      if (!fs.existsSync(to)) fs.renameSync(from, to);
      return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Fabric modlari yanlislikla .marsana-stashed-forge ile gizlendiyse geri yukle (26.x uyumlu olanlar). */
function recoverFabricModsFromMisstash(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) return 0;
  const suffix = '.marsana-stashed-forge';
  let restored = 0;
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith(suffix)) continue;
    const base = entry.slice(0, -suffix.length);
    if (!base.endsWith('.jar')) continue;
    if (modCompatibilityService.isJarFilenameIncompatibleWithGame(base, gameVersion)) {
      removeIfExists(path.join(modsDir, entry));
      continue;
    }
    const from = path.join(modsDir, entry);
    const to = path.join(modsDir, base);
    try {
      if (fs.existsSync(to)) {
        fs.unlinkSync(from);
      } else {
        fs.renameSync(from, to);
        restored += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return restored;
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function installBundledClothConfig({ repoRoot, modsDir, gameVersion, onNotice }) {
  reenableClothConfigJar(modsDir);
  if (clothConfigJarPresent(modsDir)) return null;
  if (!/^26\.1(?:\.|$)/.test(String(gameVersion || '').trim())) return null;

  const src = path.join(bundledDepsRoot(repoRoot), CLOTH_CONFIG_BUNDLED);
  if (!fs.existsSync(src)) {
    if (onNotice) onNotice('cloth-config paket icinde yok — Modrinth indirmesi deneniyor.');
    return null;
  }

  fs.mkdirSync(modsDir, { recursive: true });
  const dest = path.join(modsDir, CLOTH_CONFIG_BUNDLED);
  fs.copyFileSync(src, dest);
  if (onNotice) onNotice(`cloth-config kuruldu (${CLOTH_CONFIG_BUNDLED}).`);
  return CLOTH_CONFIG_BUNDLED;
}

module.exports = {
  CLOTH_CONFIG_BUNDLED,
  clothConfigJarPresent,
  fabricKotlinJarPresent,
  modmenuJarPresent,
  fabricHudRuntimeDepsNeeded,
  fabricHudRuntimeDepsOk,
  kotlinRuntimeDepNeeded,
  modmenuRuntimeDepNeeded,
  reenableClothConfigJar,
  recoverFabricModsFromMisstash,
  installBundledClothConfig,
};
