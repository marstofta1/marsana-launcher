'use strict';

const fs = require('fs');
const path = require('path');

const { CLIENT_HUD_MOD_SLUGS } = require('../../shared/clientHudModRegistry');
const marsanaClientModService = require('./marsanaClientModService');

const CLIENT_PACK_STASH_SUFFIX = '.marsana-stashed-client-pack';
// Create modunun kurduğu jar'ları (eklentiler + FPS modları) listeleyen işaret dosyası.
const CREATE_MARKER_FILE = '.marsana-create.json';

/** Create modu kendi kurduğu jar'ları yönetir; client paketi izolasyonu bunları gizlememeli. */
function readCreateManagedJars(modsDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(modsDir, CREATE_MARKER_FILE), 'utf8'));
    return new Set(Array.isArray(raw && raw.jars) ? raw.jars.map((j) => path.basename(String(j))) : []);
  } catch {
    return new Set();
  }
}

// Kullanıcının "Mod ekle" ile eklediği jar'lar (userModService işareti): adı client paketi
// modlarına benzese bile (minimap vb.) gizlenmemeli.
const USER_MODS_MARKER_FILE = '.marsana-user-mods.json';

function readUserManagedJars(modsDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(modsDir, USER_MODS_MARKER_FILE), 'utf8'));
    return Array.isArray(raw && raw.jars) ? raw.jars.map((j) => path.basename(String(j))) : [];
  } catch {
    return [];
  }
}

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

// Hazır mod paketlerinin (fpsBoost) kurduğu FPS modları. Bir kısmı client HUD paketi
// listesinde de var; paket seçiliyken client jar'ı sayılıp gizlenmemeli.
const FPS_BOOST_JAR_RE = /^(lithium|ferritecore|immediatelyfast|entityculling|modernfix|dynamic[-_]?fps)/i;

function isFpsBoostJar(fileName, modPresets) {
  return !!(modPresets && modPresets.fpsBoost) && FPS_BOOST_JAR_RE.test(String(fileName || ''));
}

function isClientPackJar(fileName, modPresets) {
  const lower = String(fileName || '').toLowerCase();
  if (!lower.endsWith('.jar')) return false;
  if (isFpsBoostJar(fileName, modPresets)) return false;
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
  const createManaged = readCreateManagedJars(modsDir);
  for (const jar of readUserManagedJars(modsDir)) createManaged.add(jar);

  for (const entry of fs.readdirSync(modsDir)) {
    if (entry.endsWith(CLIENT_PACK_STASH_SUFFIX)) {
      const base = entry.slice(0, -CLIENT_PACK_STASH_SUFFIX.length);
      if (
        (wantsClientPack || createManaged.has(base) || isFpsBoostJar(base, modPresets)) &&
        unstashFile(modsDir, entry)
      ) {
        restored += 1;
      }
      continue;
    }
    if (createManaged.has(entry)) continue;
    if (!entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) continue;
    if (!isClientPackJar(entry, modPresets)) continue;
    if (!wantsClientPack && stashFile(modsDir, entry)) stashed += 1;
  }

  return { stashed, restored };
}

function activeClientPackJarsPresent(modsDir, modPresets) {
  if (!modsDir || !fs.existsSync(modsDir)) return false;
  const userManaged = readUserManagedJars(modsDir);
  return fs.readdirSync(modsDir).some(
    (entry) =>
      entry.endsWith('.jar') &&
      !userManaged.includes(entry) &&
      !entry.endsWith('.jar.disabled') &&
      isClientPackJar(entry, modPresets)
  );
}

/** Launcher modunda client jar sızıntısını engelle; client modunda paketi geri yükle. */
function enforceModIsolation(modsDir, modPresets, playMode) {
  const result = applyClientPackVisibility(modsDir, modPresets, playMode);
  if (playMode === 'client') return result;

  if (!modsDir || !fs.existsSync(modsDir)) return result;
  const createManaged = readCreateManagedJars(modsDir);
  for (const jar of readUserManagedJars(modsDir)) createManaged.add(jar);

  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) continue;
    if (createManaged.has(entry)) continue;
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
