'use strict';

const path = require('path');
const fs = require('fs');

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

/** Fabric modlari yanlislikla forge stash'ine alindigysa geri yukle. */
function recoverFabricModsFromMisstash(modsDir) {
  if (!fs.existsSync(modsDir)) return;
  const entries = fs.readdirSync(modsDir);
  const hasActive = entries.some(
    (e) => e.endsWith('.jar') && !e.endsWith('.jar.disabled') && !e.includes('.marsana-stashed-')
  );
  if (hasActive) return;
  const suffix = '.marsana-stashed-forge';
  for (const entry of entries) {
    if (!entry.endsWith(suffix)) continue;
    const base = entry.slice(0, -suffix.length);
    if (!base.endsWith('.jar')) continue;
    try {
      fs.renameSync(path.join(modsDir, entry), path.join(modsDir, base));
    } catch {
      /* ignore */
    }
  }
}

function installBundledClothConfig({ repoRoot, modsDir, gameVersion, onNotice }) {
  reenableClothConfigJar(modsDir);
  if (clothConfigJarPresent(modsDir)) return null;
  if (!/^26\./.test(String(gameVersion || '').trim())) return null;

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
  reenableClothConfigJar,
  recoverFabricModsFromMisstash,
  installBundledClothConfig,
};
