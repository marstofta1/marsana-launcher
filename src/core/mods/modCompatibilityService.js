'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

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
  { id: 'sodium-extra', test: (name) => /^sodium-extra-/i.test(name) },
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
  return /(?:^|[^0-9])26\.\d+(?:\.\d+)?(?:\b|[+._-]|$)/i.test(lower) || /\+mc26\./i.test(lower);
}

function mc26MinorOf(version) {
  const m = String(version || '').match(/^26\.(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Launcher bundled Marsana mod jar'lari (marsana-client-26.1.jar vb.). */
function isMarsanaBundledModJar(filename) {
  return /^marsana-(client|schematic-farm)/i.test(jarBaseName(filename));
}

function marsanaBundledMc26LineTag(filename) {
  const m = jarBaseName(filename).match(/marsana-(?:client|schematic-farm)-(\d+\.\d+)/i);
  return m ? m[1] : null;
}

/** 26.x jar satiri oyunun minor surumuyle eslesmeli (26.1 jar 26.2'de API kirilir). null = bu kural uygulanmaz. */
function marsanaBundledCompatibleWithGame(filename, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!isMarsanaBundledModJar(filename) || !/^26\./.test(gv)) return null;
  const line = marsanaBundledMc26LineTag(filename);
  if (!line || !/^26\./.test(line)) return true;
  const gvMinor = mc26MinorOf(gv);
  const lineMinor = mc26MinorOf(line);
  if (gvMinor == null || lineMinor == null) return true;
  return gvMinor === lineMinor;
}

function mc26VersionsCompatible(tag, gameVersion) {
  const gv = String(gameVersion || '').trim();
  const tv = String(tag || '').trim();
  if (!/^26\./.test(gv) || !/^26\./.test(tv)) return false;
  const gvMinor = mc26MinorOf(gv);
  const tvMinor = mc26MinorOf(tv);
  if (gvMinor == null || tvMinor == null) return false;
  // Ayni 26.x minor => uyumlu. Patch farkina (ya da mod surumunun MC etiketine
  // benzemesine — cloth-config'in mod surumu "26.1.154" gibi) bakma; yoksa 26.1.154
  // etiketi "26.1.2'den yeni" sanilip cloth-config yanlislikla eleniyordu.
  return gvMinor === tvMinor;
}

/** OptiFine / yeni MC paketinden kalan, dosya adinda MC etiketi olmayan modlar. */
const RECENT_ONLY_MOD_FAMILIES = Object.freeze([
  { test: /^bactromod/i, minGame: '1.21.10' },
  { test: /^serverpingerfixer/i, minGame: '1.20.5' },
  { test: /^scalablelux/i, minGame: '1.21.2' },
  { test: /^rrls-/i, minGame: '1.20.1' },
  { test: /^mod-loading-screen/i, minGame: '1.20.1' },
  { test: /^entity[-_]?model[-_]?features/i, minGame: '1.20.1' },
  { test: /^entity[-_]?texture[-_]?features/i, minGame: '1.20.1' },
  { test: /^languagereload/i, minGame: '1.20.1' },
  { test: /^forgeconfigapiport/i, minGame: '1.20.1' },
  { test: /^fzzy[-_]?config/i, minGame: '1.20.1' },
  { test: /^libjf/i, minGame: '1.20.1' },
  { test: /^c2me-/i, minGame: '1.20.1' },
]);

function isClassicOneDotGameVersion(gameVersion) {
  return /^1\.\d+(\.\d+)?$/.test(String(gameVersion || '').trim());
}

function isRecentOnlyModForClassicGame(lower, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!isClassicOneDotGameVersion(gv)) return false;
  return RECENT_ONLY_MOD_FAMILIES.some(
    (entry) => entry.test.test(lower) && compareSemver(gv, entry.minGame) < 0
  );
}

function isActiveJarEntry(entry) {
  return (
    (entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) &&
    !entry.includes('.marsana-stashed-')
  );
}

/** Mod semver (16.0.1, 20.0.149) ile MC surumunu ayir. */
function isPlausibleMcVersionTag(tag) {
  const t = String(tag || '').trim();
  if (!t) return false;
  if (/^26\.\d+(?:\.\d+)?$/.test(t)) return true;
  const m = t.match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const minor = parseInt(m[1], 10);
  return minor >= 6 && minor <= 30;
}

function classicMcMinorBase(version) {
  const m = String(version || '').match(/^(1\.\d+)\./);
  return m ? m[1] : null;
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
    if (m && m[1] && isPlausibleMcVersionTag(m[1])) return m[1];
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
  if (/^26\./.test(gv) && /^26\./.test(tag)) {
    return mc26VersionsCompatible(tag, gv);
  }
  if (/^\d+\.\d+\.\d+$/.test(gv) && /^\d+\.\d+\.\d+$/.test(tag)) {
    const gvBase = gv.match(/^(\d+\.\d+)\./)?.[1];
    const tagBase = tag.match(/^(\d+\.\d+)\./)?.[1];
    if (gvBase && tagBase && gvBase === tagBase) return false;
  }
  return false;
}

function isPlatformIncompatibleModJar(filename) {
  const lower = jarBaseName(filename);
  if (process.platform === 'darwin') return false;
  if (/macos/i.test(lower) && /input/i.test(lower)) return true;
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

function isWrongMc26ClientOrCloth(filename, gv) {
  const lower = jarBaseName(filename);
  const isClientOrCloth = /^marsana-client/i.test(lower) || /^marsana-schematic-farm/i.test(lower) || /^cloth-config/i.test(lower);
  if (!isClientOrCloth) return false;

  const marsanaOk = marsanaBundledCompatibleWithGame(filename, gv);
  if (marsanaOk !== null) return !marsanaOk;

  if (isMc26GameVersion(gv)) {
    const tag = parseJarMinecraftVersionTag(filename);
    if (tag && /^26\./.test(tag)) {
      return !mc26VersionsCompatible(tag, gv);
    }
    const minor = mc26MinorOf(gv);
    if (minor != null && new RegExp(`(?:^|[^0-9])26\\.${minor}(?:\\.|\\b|[+_-])`).test(lower)) {
      return false;
    }
    return true;
  }

  if (hasMc26Tag(lower) || /26\.\d/i.test(lower)) return true;
  return false;
}

/** Dosya adindan hedef MC surumu belli ama secilen surumle uyumsuz mu? */
function isJarFilenameIncompatibleWithGame(filename, gameVersion) {
  const gv = String(gameVersion || '').trim();
  if (!gv) return false;
  const lower = jarBaseName(filename);

  if (isWrongMc26ClientOrCloth(filename, gv)) return true;
  if (isPlatformIncompatibleModJar(filename)) return true;

  const marsanaOk = marsanaBundledCompatibleWithGame(filename, gv);
  if (marsanaOk !== null) return !marsanaOk;

  if (isMc26GameVersion(gv)) {
    const tag = parseJarMinecraftVersionTag(filename);
    if (tag) {
      if (/^26\./.test(tag)) return !mc26VersionsCompatible(tag, gv);
      return true;
    }
    if (/fabric-api.*26\./i.test(lower) && new RegExp(`26\\.${mc26MinorOf(gv)}`).test(lower)) {
      return false;
    }
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

  if (isClassicOneDotGameVersion(gv)) {
    if (hasMc26Tag(lower)) return true;
    if (tag && /^26\./.test(tag)) return true;
    if (tag && /^\d+\.\d+\.\d+$/.test(gv) && compareSemver(tag, gv) > 0) return true;
    if (isRecentOnlyModForClassicGame(lower, gv)) return true;
  }

  if (/^\d+\.\d+\.\d+$/.test(gv) && !/^26\./.test(gv)) {
    if (REQUIRES_EXACT_MC_TAG_ON_CLASSIC_PATCH.some((re) => re.test(lower))) {
      if (!tag) return false;
      if (tag === gv) return false;
      const gvBase = classicMcMinorBase(gv);
      const tagBase = classicMcMinorBase(tag);
      // Modrinth bazen 1.21.10 icin yalnizca +1.21.9 etiketli jar listeler (modmenu, cloth-config).
      if (gvBase && tagBase && gvBase === tagBase && compareSemver(tag, gv) <= 0) return false;
      return true;
    }
    if (tag && compareSemver(tag, gv) > 0) return true;
  }

  if (!isManagedModFamilyJar(filename)) return false;
  return !jarVersionMatchesGame(filename, gv);
}

// ---------------------------------------------------------------------------
// Manifest tabanli uyumluluk: jar'in fabric.mod.json > depends.minecraft alanini
// okuyup oyun surumune gore degerlendirir. Dosya adinda MC etiketi olmayan modlar
// (krypton, modernfix vb.) yalnizca buradan yakalanabilir — Fabric loader'in
// kendi kararini launch oncesi taklit ederiz.
//
// Kural TEMKINLI: yalnizca EMIN oldugumuzda 'incompatible' doneriz. Herhangi bir
// terim ayrıştırılamazsa 'unknown' doneriz ve cagiran taraf dosya-adi sezgisine
// duser — boylece gecerli bir mod asla yanlislikla silinmez.

/** Surum dizesini sayisal release parcalarina ayir. On-surum/build ('-','+') atilir. */
function parseVersionParts(str) {
  let s = String(str == null ? '' : str).trim();
  if (!s) return { parts: [], wildcard: false, ok: false };
  s = s.split('+')[0].split('-')[0].replace(/^v/i, '');
  if (!s) return { parts: [], wildcard: false, ok: false };
  const parts = [];
  let wildcard = false;
  for (const token of s.split('.')) {
    if (token === 'x' || token === 'X' || token === '*') {
      wildcard = true;
      break;
    }
    if (!/^\d+$/.test(token)) return { parts, wildcard, ok: false };
    parts.push(parseInt(token, 10));
  }
  return { parts, wildcard, ok: true };
}

function comparePartsNum(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const da = a[i] || 0;
    const db = b[i] || 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/** Tek bir Fabric surum-sarti terimini degerlendir: 'match' | 'nomatch' | 'unknown'. */
function evalPredicateTerm(term, gameParts) {
  const t = String(term || '').trim();
  if (!t || t === '*') return 'match';
  const m = t.match(/^(>=|<=|>|<|=|\^|~)?\s*(.*)$/);
  const op = (m && m[1]) || '=';
  const verStr = (m && m[2] ? m[2] : '').trim();
  if (!verStr) return 'unknown';
  const v = parseVersionParts(verStr);
  if (!v.ok && !v.wildcard) return 'unknown';

  if (op === '>=' || op === '>' || op === '<=' || op === '<') {
    if (v.wildcard || v.parts.length === 0) return 'unknown';
    const cmp = comparePartsNum(gameParts, v.parts);
    if (op === '>=') return cmp >= 0 ? 'match' : 'nomatch';
    if (op === '>') return cmp > 0 ? 'match' : 'nomatch';
    if (op === '<=') return cmp <= 0 ? 'match' : 'nomatch';
    return cmp < 0 ? 'match' : 'nomatch';
  }

  if (op === '~' || op === '^') {
    if (v.parts.length === 0) return 'unknown';
    const lower = v.parts.slice();
    let upper;
    if (op === '~') {
      // ~a.b(.c) => < a.(b+1).0 ; ~a => < (a+1).0.0
      upper = v.parts.length >= 2 ? [v.parts[0], v.parts[1] + 1, 0] : [v.parts[0] + 1, 0, 0];
    } else {
      // ^a.b.c => < (a+1).0.0
      upper = [v.parts[0] + 1, 0, 0];
    }
    return comparePartsNum(gameParts, lower) >= 0 && comparePartsNum(gameParts, upper) < 0
      ? 'match'
      : 'nomatch';
  }

  // op '=' veya operatorsuz.
  if (v.wildcard) {
    // 26.1.x => parts=[26,1] => >= [26,1,0] < [26,2,0]
    if (v.parts.length === 0) return 'match';
    const lower = v.parts.slice();
    const upper = v.parts.slice();
    upper[upper.length - 1] += 1;
    return comparePartsNum(gameParts, lower) >= 0 && comparePartsNum(gameParts, upper) < 0
      ? 'match'
      : 'nomatch';
  }
  // Cıplak surum: belirtilen parca sayisinca prefix esitligi (26.1 => tum 26.1.x eslesir).
  for (let i = 0; i < v.parts.length; i += 1) {
    if ((gameParts[i] || 0) !== v.parts[i]) return 'nomatch';
  }
  return 'match';
}

/** Bosluklu terimler VE'lenir (Fabric semantigi): "26.1 <27" => >=26.1 VE <27. */
function evalPredicateString(str, gameParts) {
  const terms = String(str || '').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 'match';
  let sawUnknown = false;
  for (const term of terms) {
    const r = evalPredicateTerm(term, gameParts);
    if (r === 'nomatch') return 'nomatch';
    if (r === 'unknown') sawUnknown = true;
  }
  return sawUnknown ? 'unknown' : 'match';
}

/**
 * depends.minecraft (string ya da dizi) oyun surumunu karsiliyor mu?
 * Dizi => VEYA (herhangi biri eslesirse yeter). Donus: 'compatible' | 'incompatible' | 'unknown'.
 */
function evaluateMcDependency(dep, gameVersion) {
  const gameParts = parseVersionParts(gameVersion).parts;
  if (!gameParts.length) return 'unknown';
  const branches = (Array.isArray(dep) ? dep : [dep]).filter(
    (b) => typeof b === 'string' && b.trim()
  );
  if (branches.length === 0) return 'unknown';
  let sawUnknown = false;
  let sawNoMatch = false;
  for (const branch of branches) {
    const r = evalPredicateString(branch, gameParts);
    if (r === 'match') return 'compatible';
    if (r === 'unknown') sawUnknown = true;
    if (r === 'nomatch') sawNoMatch = true;
  }
  if (sawNoMatch && !sawUnknown) return 'incompatible';
  return 'unknown';
}

/** Jar icindeki fabric.mod.json > depends.minecraft degerini oku (yoksa/okunamazsa undefined). */
function readJarMcDependency(jarPath) {
  try {
    const buf = fs.readFileSync(jarPath);
    const zip = new AdmZip(buf);
    const entry = zip.getEntry('fabric.mod.json');
    if (!entry) return undefined;
    const json = JSON.parse(zip.readAsText(entry));
    if (!json || typeof json !== 'object' || !json.depends) return undefined;
    const dep = json.depends.minecraft;
    return dep == null ? undefined : dep;
  } catch {
    return undefined;
  }
}

/** Jar'in bildirdigi MC bagimliligina gore karar: 'compatible' | 'incompatible' | 'unknown'. */
function jarManifestMcVerdict(jarPath, gameVersion) {
  const dep = readJarMcDependency(jarPath);
  if (dep === undefined) return 'unknown';
  return evaluateMcDependency(dep, gameVersion);
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
  const gv = String(gameVersion || '').trim();
  const tag = parseJarMinecraftVersionTag(name);
  if (tag && gv && tag === gv) return 1000;
  if (tag && gv && /^26\./.test(gv) && mc26VersionsCompatible(tag, gv)) return 950;
  if (/^26\./.test(gv)) {
    const minor = mc26MinorOf(gv);
    if (minor != null && new RegExp(`26\\.${minor}`).test(lower)) return 900;
  }
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

function sodiumExtraJarPresent(modsDir, gameVersion) {
  return familyJarPresent(modsDir, (f) => /^sodium-extra-/i.test(f), gameVersion);
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

const BUNDLE_FILE = '.marsana-mod-bundle.json';

function purgeForeignGameVersionBundle(modsDir, gameVersion) {
  const bundlePath = path.join(modsDir, BUNDLE_FILE);
  if (!fs.existsSync(bundlePath)) return 0;
  let bundle;
  try {
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  } catch {
    return 0;
  }
  if (!bundle.gameVersion || bundle.gameVersion === gameVersion) return 0;

  let removed = 0;
  for (const jar of bundle.jars || []) {
    const target = path.join(modsDir, jar);
    if (fs.existsSync(target)) {
      removeIfExists(target);
      removed += 1;
    }
  }
  removeIfExists(bundlePath);
  removeIfExists(path.join(modsDir, '.marsana-shader-ready.json'));
  return removed;
}

/** Yanlis MC surumlu yonetilen mod jar'larini ve fazla kopyalari temizle. */
function purgeIncompatibleModJars(modsDir, gameVersion) {
  if (!fs.existsSync(modsDir)) {
    return { removed: 0, fabricApiKept: null };
  }

  const gv = String(gameVersion || '').trim();
  let removed = purgeForeignGameVersionBundle(modsDir, gv);
  for (const entry of fs.readdirSync(modsDir)) {
    const isJar = entry.endsWith('.jar') || entry.endsWith('.jar.disabled');
    const isStash = entry.includes('.marsana-stashed-');
    if (!isJar && !isStash) continue;
    const fullPath = path.join(modsDir, entry);
    const jarName = entry.split('.marsana-stashed-')[0];
    // Manifest (fabric.mod.json > depends.minecraft) otoriterdir: dosya adinda MC
    // etiketi olmayan 26.2-ozel jar'lari (krypton >=26.2, modernfix ~26.2) yakalar;
    // ayrica dosya-adi sezgisinin yanlis eledigi jar'i (cloth-config-26.1.154 => >=26.1)
    // korur. Karar veremezse ('unknown') mevcut dosya-adi sezgisine duseriz.
    const verdict = jarManifestMcVerdict(fullPath, gameVersion);
    let incompatible;
    if (verdict === 'incompatible') incompatible = true;
    else if (verdict === 'compatible') incompatible = false;
    else incompatible = isJarFilenameIncompatibleWithGame(jarName, gameVersion);
    if (!incompatible) continue;
    removeIfExists(fullPath);
    removed += 1;
  }

  dedupeShaderStackMods(modsDir, gameVersion);
  const fabricApiKept = dedupeFabricApiJars(modsDir, gameVersion);
  return { removed, fabricApiKept };
}

module.exports = {
  isMc26GameVersion,
  mc26VersionsCompatible,
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
  sodiumExtraJarPresent,
  kryptonJarPresent,
  isManagedModFamilyJar,
  evaluateMcDependency,
  readJarMcDependency,
  jarManifestMcVerdict,
};
