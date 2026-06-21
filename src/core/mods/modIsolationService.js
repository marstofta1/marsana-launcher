'use strict';

const fs = require('fs');
const path = require('path');

const { CLIENT_HUD_MOD_SLUGS } = require('../../shared/clientHudModRegistry');
const marsanaClientModService = require('./marsanaClientModService');

const CLIENT_PACK_STASH_SUFFIX = '.marsana-stashed-client-pack';

/** Shader cekirdegi — client HUD paketinden ayri tutulur. */
const CORE_LAUNCHER_JAR_HINTS = Object.freeze([
  /^fabric-api/i,
  /^sodium-[\d.]/i,
  /^iris/i,
  /^indium/i,
  /^continuity/i,
  /^optifine/i,
]);

function slugFilenameHints() {
  const hints = new Set();
  for (const slug of CLIENT_HUD_MOD_SLUGS) {
    hints.add(slug.toLowerCase());
    hints.add(slug.replace(/-/g, '').toLowerCase());
    hints.add(slug.replace(/-/g, '_').toLowerCase());
  }
  return hints;
}

const HUD_FILENAME_HINTS = slugFilenameHints();

function isCoreLauncherJar(fileName) {
  const lower = String(fileName || '').toLowerCase();
  return CORE_LAUNCHER_JAR_HINTS.some((re) => re.test(lower));
}

function isClientPackJar(fileName, modPresets) {
  const lower = String(fileName || '').toLowerCase();
  if (!lower.endsWith('.jar')) return false;
  if (/^sodium-[\d.]/i.test(lower) && modPresets && modPresets.sodium) return false;
  if (/^sodium-extra-/i.test(lower) && modPresets && modPresets.sodiumExtra) return false;
  if (marsanaClientModService.isMarsanaClientJar(fileName)) return true;
  if (/^cloth-config/i.test(lower)) return true;
  if (isCoreLauncherJar(fileName)) return false;
  for (const hint of HUD_FILENAME_HINTS) {
    if (hint.length >= 4 && lower.includes(hint)) return true;
  }
  return false;
}

function stashFile(modsDir, fileName) {
  const from = path.join(modsDir, fileName);
  const to = path.join(modsDir, `${fileName}${CLIENT_PACK_STASH_SUFFIX}`);
  try {
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.renameSync(from, to);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function unstashFile(modsDir, stashedName) {
  if (!stashedName.endsWith(CLIENT_PACK_STASH_SUFFIX)) return false;
  const to = path.join(modsDir, stashedName.slice(0, -CLIENT_PACK_STASH_SUFFIX.length));
  const from = path.join(modsDir, stashedName);
  try {
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.renameSync(from, to);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Client HUD / Marsana menü kapaliysa jar'lari mods klasorunden gizle. */
function applyClientPackVisibility(modsDir, modPresets, playMode) {
  if (!modsDir || !fs.existsSync(modsDir)) return { stashed: 0, restored: 0 };

  const wantsClientPack =
    playMode === 'client' &&
    modPresets &&
    (modPresets.clientHudPack || modPresets.marsanaClientMenu);

  let stashed = 0;
  let restored = 0;

  for (const entry of fs.readdirSync(modsDir)) {
    if (entry.endsWith(CLIENT_PACK_STASH_SUFFIX)) {
      if (wantsClientPack && unstashFile(modsDir, entry)) restored += 1;
      continue;
    }
    if (!entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) continue;
    if (!isClientPackJar(entry, modPresets)) continue;
    if (!wantsClientPack && stashFile(modsDir, entry)) stashed += 1;
  }

  return { stashed, restored };
}

function activeClientPackJarsPresent(modsDir) {
  if (!modsDir || !fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some(
    (entry) =>
      entry.endsWith('.jar') &&
      !entry.endsWith('.jar.disabled') &&
      isClientPackJar(entry)
  );
}

/** Launcher modunda client jar sızıntısını engelle; client modunda paketi geri yükle. */
function enforceModIsolation(modsDir, modPresets, playMode) {
  const result = applyClientPackVisibility(modsDir, modPresets, playMode);
  if (playMode === 'client') return result;

  if (!modsDir || !fs.existsSync(modsDir)) return result;

  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) continue;
    if (!isClientPackJar(entry, modPresets)) continue;
    if (stashFile(modsDir, entry)) result.stashed += 1;
  }

  return result;
}

function shouldUseClientPack(modPresets, playMode) {
  const sanitized = marsanaClientModService.sanitizeModPresetsForPlayMode(modPresets, playMode);
  return (
    playMode === 'client' && (sanitized.clientHudPack || sanitized.marsanaClientMenu)
  );
}

module.exports = {
  CLIENT_PACK_STASH_SUFFIX,
  isClientPackJar,
  applyClientPackVisibility,
  activeClientPackJarsPresent,
  enforceModIsolation,
  shouldUseClientPack,
};
