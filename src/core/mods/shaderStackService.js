'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const { LauncherError, Codes } = require('../infra/errors');
const { extractZipInside, assertInside } = require('../infra/safeZip');
const marsanaClientModService = require('./marsanaClientModService');
const schematicFarmModService = require('./schematicFarmModService');
const modIsolationService = require('./modIsolationService');
const hudDepsService = require('./hudDepsService');
const modCompatibilityService = require('./modCompatibilityService');
const { CLIENT_HUD_MOD_SLUGS, CLIENT_HUD_REQUIRED_SLUGS } = require('../../shared/clientHudModRegistry');
const { MARSANA_SERVER_PINNED_MODS } = require('../../shared/marsanaServer');
// O4 â€” Modrinth sÃ¼rÃ¼m-seÃ§im mantÄ±ÄŸÄ± ayrÄ±, baÄŸÄ±msÄ±z test edilebilir modÃ¼le taÅŸÄ±ndÄ±.
// AynÄ± adlarla iÃ§e alÄ±nÄ±r; tÃ¼m Ã§aÄŸrÄ± yerleri deÄŸiÅŸmeden Ã§alÄ±ÅŸÄ±r.
const {
  extractMcVersionFromModMeta,
  versionMatchesGamePatch,
  modrinthLoaderModGameVersionCandidates,
  modrinthClassicFallbacksForGameVersion,
  modrinthGameVersionCandidates,
  versionListsAnyGame,
  modrinthCandidateRank,
  versionMatchesLoaderModGame,
  versionMatchesGameForFetch,
  pickNewestModrinthVersion,
  expandResourcePackGameVersions,
  versionListsGame,
  glowingOresVariantLabel,
  pickGlowingOresVersion,
} = require('./modrinthVersionSelect');

const BUNDLE_FILE = '.marsana-mod-bundle.json';
const READY_FILE = '.marsana-shader-ready.json';
// 49: forge-config-api-port slug duzeltmesi. Onceki buggy reconcile, zaten
// cokmus kullanicilarda forgeconfigapiport'suz "hazir" bir bundle birakiyordu;
// bump olmadan cachedReady o onbellegi gecerli sayip reconcile'i atlar ve crash
// surerdi. Bump, sonraki acilista yeniden cozumleme + reconcile'i zorlar.
const SHADER_BUNDLE_VERSION = 49;

// Anchor mod'larÄ± Ã¶nce yazÄ±yoruz; dependency Ã§Ã¶zÃ¼mlemesi onlardan baÅŸlar,
// bÃ¶ylece Iris/Continuity istedikleri Sodium sÃ¼rÃ¼mÃ¼nÃ¼ kilitler.
const SHADER_FPS_SLUGS = Object.freeze(['iris', 'fabric-api']);
const EMBOSSED_SLUGS = Object.freeze(['continuity', 'fabric-api']);
const VOICE_CHAT_SLUG = 'simple-voice-chat';
const CREATE_SLUG = 'create';
// Create kutusu iÅŸaretlenince Create ile birlikte kurulan, bilerek kÄ±sa tutulmuÅŸ eklenti
// listesi (disk/RAM/FPS). Ã–rtÃ¼ÅŸenler (Create Generators, Crafts & Additions, dekor
// paketleri) bilerek yok. YalnÄ±zca zorunlu baÄŸÄ±mlÄ±lÄ±klar Ã§ekilir.
const CREATE_ADDON_SLUGS = Object.freeze([
  'create-aeronautics',
  'create-steam-n-rails-1.21.1',
  'create-railways-navigator',
  'create-diesel-generators',
  'power-grid',
  'create-connected',
  'create-dreams-and-desires',
  'create-framed',
]);
// Modrinth'te olmayan (Ã¶r. incelemede) Create eklentileri: jar launcher'la gelir
// (bundled-mods/create-addons/), hash doÄŸrulanÄ±p kopyalanÄ±r. Modrinth'e Ã§Ä±kÄ±nca
// slug'Ä± CREATE_ADDON_SLUGS'a taÅŸÄ±, buradan sil.
const CREATE_BUNDLED_ADDONS = Object.freeze([
  Object.freeze({
    slug: 'create-engines',
    file: 'create_engines-1.21.1-0.1.1.jar',
    bundled: 'create-addons/create_engines-1.21.1-0.1.1.jar',
    sha512:
      '820fd02e66ab21b23adad60cf25de5098e1afc8ddfbc3d9502d1ad52eb67d2e0c327f31e87c9ee558734de655ca97013353f1090475e05098dc86d785a6baff4',
  }),
]);
// Create modunda FPS/RAM kazancÄ± iÃ§in kurulan hafif NeoForge optimizasyon modlarÄ±
// (toplam ~4 MB). Hepsi opsiyonel: bulunamazsa atlanÄ±r.
const CREATE_PERF_SLUGS = Object.freeze([
  'sodium',
  'modernfix',
  'immediatelyfast',
  'ferrite-core',
  'entityculling',
  'lithium',
]);
// Create modu ilk kez aÃ§Ä±ldÄ±ÄŸÄ±nda aÄŸÄ±r video ayarlarÄ±nÄ± (render mesafesi 32 gibi) bir kez
// sÄ±nÄ±rlar; kullanÄ±cÄ± sonra oyun iÃ§inden yÃ¼kseltirse tekrar ezilmez.
const NEWLINE_RE = /\r?\n/;
const CREATE_VIDEO_CAPS = Object.freeze({
  renderDistance: 10,
  simulationDistance: 8,
  entityDistanceScaling: 1.0,
  biomeBlendRadius: 3,
  mipmapLevels: 2,
});
// Entegre ekran kartlarÄ±nda GPU darboÄŸazÄ±: gÃ¶lge ve Flywheel'in aÄŸÄ±r Ä±ÅŸÄ±k/compute yolu.
const CREATE_VIDEO_FORCE = Object.freeze({ entityShadows: 'false' });
// Tek oyunculu yerleÅŸik sunucu simÃ¼lasyon mesafesi bÃ¼yÃ¼kse (Create makineleri, Aeronautics
// fiziÄŸi) sunucu iÅŸ parÃ§acÄ±ÄŸÄ± yetiÅŸemez ("Can't keep up"). Ekranda gÃ¶rÃ¼nmez; her aÃ§Ä±lÄ±ÅŸta sÄ±nÄ±rlanÄ±r.
const CREATE_SIMULATION_DISTANCE_MAX = 8;
// Vanilla render mesafesi Ã¼st sÄ±nÄ±rÄ±: 32 chunk yerleÅŸik sunucuyu chunk Ã¼retimiyle boÄŸuyor
// ("Can't keep up") ve ekran kartÄ±nÄ± yoruyor. Distant Horizons denendi ama uzak arazi gÃ¶rÃ¼ntÃ¼sÃ¼
// beÄŸenilmedi (blok blok), bu yÃ¼zden pakette yok; 12 chunk net ve akÄ±cÄ±.
const CREATE_RENDER_DISTANCE_MAX = 12;
// HazÄ±r mod paketleri (Tam Paket / FPS Paketi) iÃ§in Fabric FPS/RAM modlarÄ±. Hepsi opsiyonel:
// seÃ§ili Minecraft sÃ¼rÃ¼mÃ¼nde uygun sÃ¼rÃ¼mÃ¼ yoksa atlanÄ±r.
const FPS_BOOST_SLUGS = Object.freeze([
  'lithium',
  'ferrite-core',
  'immediatelyfast',
  'entityculling',
  'modernfix',
  'dynamic-fps',
]);
// Paket ilk kez aÃ§Ä±ldÄ±ÄŸÄ±nda render mesafesi bu deÄŸere ayarlanÄ±r (sonra oyun iÃ§inden deÄŸiÅŸtirilebilir).
const FPS_BOOST_RENDER_DISTANCE = 12;
// Vanilla varsayÄ±lanÄ± maxFps:120 â€” FPS modlarÄ± ne kazandÄ±rÄ±rsa kazandÄ±rsÄ±n sayaÃ§ 120'de takÄ±lÄ±r.
// 260 = oyundaki "SÄ±nÄ±rsÄ±z".
// FPS Paketi sÄ±nÄ±rÄ± kaldÄ±rÄ±r ('unlimited'); Tam Paket 120'de sabit tutar ('capped').
const FPS_BOOST_FORCED_OPTIONS = Object.freeze({
  unlimited: Object.freeze({
    renderDistance: FPS_BOOST_RENDER_DISTANCE,
    maxFps: 260,
    enableVsync: 'false',
  }),
  capped: Object.freeze({
    renderDistance: FPS_BOOST_RENDER_DISTANCE,
    maxFps: 120,
  }),
});
// Zorlanan ayar listesi deÄŸiÅŸince artÄ±r: mevcut kurulumlarda ayar bir kez daha uygulanÄ±r.
const FPS_BOOST_TUNE_VERSION = 4;
// Paket dÄ±ÅŸÄ±nda (Create dahil) geri alÄ±nan ayarlar ve Ã¶nceki deÄŸer bilinmiyorsa dÃ¶nÃ¼lecek vanilla varsayÄ±lanÄ±.
// options.txt tÃ¼m yÃ¼kleyicilerde ortak; geri alÄ±nmazsa sÄ±nÄ±rsÄ±z FPS diÄŸer profillere de sÄ±zar.
const FPS_BOOST_RESTORE_DEFAULTS = Object.freeze({ maxFps: '120' });
const FPS_BOOST_MARKER_FILE = '.marsana-fps-pack.json';
const FLYWHEEL_CONFIG_REL = path.join('config', 'flywheel-client.toml');
// Launcher'Ä±n indirdiÄŸi Create jar'larÄ±nÄ±n adlarÄ± burada tutulur; seÃ§im kaldÄ±rÄ±ldÄ±ÄŸÄ±nda
// yalnÄ±zca bu jar silinir, kullanÄ±cÄ±nÄ±n elle koyduÄŸu Create'e dokunulmaz.
const CREATE_MARKER_FILE = '.marsana-create.json';
const STASH_SUFFIXES = ['.marsana-stashed-fabric', '.marsana-stashed-forge'];
const FULLBRIGHT_UB_SLUG = 'fullbright-ub';
const POLYTONE_SLUG = 'polytone';
const FULLBRIGHT_PACK_LOCAL_NAME = 'fullbright-ub.zip';
const BETTER_LEAVES_SLUG = 'better-leaves';
const BETTER_LEAVES_PACK_LOCAL_NAME = 'better-leaves.zip';
const CULL_LEAVES_SLUG = 'cull-leaves';
const GLOWING_ORES_SLUG = 'new-glowing-ores';
const GLOWING_ORES_PACK_LOCAL_NAME = 'new-glowing-ores.zip';
const ROUND_TREES_SLUG = 'round-trees';
const ROUND_TREES_PACK_LOCAL_NAME = 'round-trees.zip';
const CROPS_3D_SLUG = '3d-crops';
const CROPS_3D_PACK_LOCAL_NAME = '3d-crops.zip';
const CONTINUITY_SLUG = 'continuity';
const SODIUM_EXTRA_SLUG = 'sodium-extra';
const SODIUM_SLUG = 'sodium';
const DEFAULT_SHADER_SLUG = 'complementary-reimagined';
const OPTIFINE_PROJECT = 'optifine-for-fabric';

// UI'dan gelen shader slug'Ä±nÄ± kabul edilen deÄŸerlere kÄ±s â€” geÃ§ersiz/eski bir
// slug Modrinth'te 404'e dÃ¶nÃ¼p tÃ¼m launch'u patlatabilir. TanÄ±nmayan slug
// iÃ§in sessizce default'a dÃ¼ÅŸ.
const KNOWN_SHADER_SLUGS = new Set([
  'complementary-reimagined', 'complementary-unbound', 'bsl-shaders',
  'photon-shader', 'solas-shader', 'bliss-shader', 'rethinking-voxels',
  'makeup-ultra-fast-shaders', 'potato-shaders', 'super-duper-vanilla', 'insanity-shader',
  'pastel-shaders', 'mellow', 'astralex', 'nostalgia-shader',
  'miniature-shader', 'vanillaa', 'hysteria-shaders', 'kappa-shader',
  'spooklementary', 'lite-shaders', 'clarityshader',
]);

function resolveShaderSlug(requested) {
  if (typeof requested === 'string' && KNOWN_SHADER_SLUGS.has(requested)) return requested;
  return DEFAULT_SHADER_SLUG;
}

// Modrinth dosya adlarÄ± (AstraLex vb.) Â§ kodlarÄ± iÃ§erebiliyor. Yerel diskte
// her zaman slug.zip kullan â€” Iris eÅŸleÅŸmesi ve Ã¶nbellek tutarlÄ± kalÄ±r.
function shaderPackLocalName(slug) {
  return `${resolveShaderSlug(slug)}.zip`;
}

function isModrinthNotFound(err) {
  return err instanceof LauncherError && err.code === Codes.MODRINTH_NOT_FOUND;
}

// (Modrinth sÃ¼rÃ¼m-seÃ§im yardÄ±mcÄ±larÄ± modrinthVersionSelect.js'e taÅŸÄ±ndÄ± â€” yukarÄ±da
//  require ile aynÄ± adlarla iÃ§e alÄ±nÄ±r.)

// Modrinth'te en yeni sÃ¼rÃ¼m "Border" (yalnÄ±zca Continuity); OptiFine yolu "Default" ister.
// 1.21.9+ ve 26.x: pack.mcmeta min_format/max_format zorunlu; Modrinth paketleri
// eski pack_format + supported_formats ile gelince oyun baÅŸlangÄ±Ã§ta paketi siliyor.
function resourcePackFormatForGameVersion(gameVersion) {
  const id = String(gameVersion || '').trim();
  const m26 = id.match(/^26\.(\d+)(?:\.(\d+))?$/);
  if (m26) {
    const minor = parseInt(m26[1], 10);
    if (minor <= 1) return 84;
    if (minor === 2) return 88;
    return 84 + (minor - 1) * 4;
  }
  const m121 = id.match(/^1\.21(?:\.(\d+))?$/);
  if (m121) {
    const patch = m121[1] ? parseInt(m121[1], 10) : 0;
    if (patch <= 1) return 34;
    if (patch === 2 || patch === 3) return 42;
    if (patch === 4) return 46;
    if (patch === 5) return 55;
    if (patch === 6 || patch === 7) return 63;
    if (patch === 8) return 64;
    if (patch === 9 || patch === 10) return 69;
    if (patch === 11) return 75;
    return 69;
  }
  if (/^1\.22/.test(id)) return 88;
  return null;
}

function gameUsesModernResourcePackFormat(gameVersion) {
  const fmt = resourcePackFormatForGameVersion(gameVersion);
  return fmt != null && fmt >= 65;
}

function packFormatScalar(fmt) {
  if (fmt == null) return null;
  if (Array.isArray(fmt)) return fmt[0];
  return fmt;
}

function packAlreadySupportsGameFormat(pack, format) {
  const min = packFormatScalar(pack.min_format);
  const max = packFormatScalar(pack.max_format);
  if (min == null || max == null) return false;
  // 1.21.9+ oyunlarÄ± geniÅŸ min/max aralÄ±ÄŸÄ±nÄ± (Ã¶r. 55â€“84) reddedip options.txt'ten
  // silebiliyor; hedef sÃ¼rÃ¼mle birebir eÅŸleÅŸme gerekir.
  return (
    min === format &&
    max === format &&
    pack.pack_format == null &&
    pack.supported_formats == null
  );
}

function patchResourcePackZipForGameVersion(zipPath, gameVersion) {
  if (!gameUsesModernResourcePackFormat(gameVersion)) return false;
  const format = resourcePackFormatForGameVersion(gameVersion);
  if (format == null || !fs.existsSync(zipPath)) return false;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('pack.mcmeta');
  if (!entry) return false;

  let meta;
  try {
    meta = JSON.parse(entry.getData().toString('utf8'));
  } catch {
    return false;
  }

  const pack = meta.pack || {};
  if (packAlreadySupportsGameFormat(pack, format)) return false;

  const description = pack.description != null ? pack.description : 'Resource pack';
  meta.pack = { description, min_format: format, max_format: format };

  // adm-zip writeZip() mevcut arÅŸivi yerinde gÃ¼ncellerken bazÄ± paketleri (3D crops vb.)
  // bozabiliyor; Ã§Ä±kar â†’ pack.mcmeta yaz â†’ yeniden zip'le akÄ±ÅŸÄ± gÃ¼venli.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-rp-'));
  const tmpOut = `${zipPath}.marsana-patch.tmp`;
  try {
    // Kaynak paketi Modrinth'ten indirilmiÅŸ uzak bir zip; girdi adlarÄ± gÃ¼venilmez.
    // adm-zip'in extractAllTo'su yerine kendi kapsama kontrolÃ¼mÃ¼z kullanÄ±lÄ±r.
    // GÃ¼vensiz bir girdi Ã§Ä±karsa hata fÄ±rlar, aÅŸaÄŸÄ±daki catch paketi olduÄŸu gibi
    // bÄ±rakÄ±r (yama uygulanmaz) â€” bozuk paket yerine yamasÄ±z paket tercih edilir.
    extractZipInside(zip, tmpRoot);
    fs.writeFileSync(path.join(tmpRoot, 'pack.mcmeta'), `${JSON.stringify(meta, null, 3)}\n`, 'utf8');
    const newZip = new AdmZip();
    newZip.addLocalFolder(tmpRoot);
    newZip.writeZip(tmpOut);
    fs.renameSync(tmpOut, zipPath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch {
      /* ignore */
    }
    return false;
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion }) {
  if (!localName || !resourcepacksDir) return;
  patchResourcePackZipForGameVersion(path.join(resourcepacksDir, localName), gameVersion);
}

function customIdFor(gameVersion, presets, shaderSlug, { loaderPrefix = 'marsana' } = {}) {
  if (presets.optifine) return `${loaderPrefix}-optifine-${gameVersion}`;
  if (presets.shaderFps && shaderSlug && KNOWN_SHADER_SLUGS.has(shaderSlug)) {
    return `${loaderPrefix}-shader-${gameVersion}-${shaderSlug}`;
  }
  if (presets.voiceChat && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm) {
    return `${loaderPrefix}-voice-${gameVersion}`;
  }
  if (presets.fullbrightUb && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm) {
    return `${loaderPrefix}-fullbright-${gameVersion}`;
  }
  if (presets.betterLeaves && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm) {
    return `${loaderPrefix}-betterleaves-${gameVersion}`;
  }
  if (presets.glowingOres && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm) {
    return `${loaderPrefix}-glowingores-${gameVersion}`;
  }
  if (presets.roundTrees && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.crops3d && !presets.schematicFarm) {
    return `${loaderPrefix}-roundtrees-${gameVersion}`;
  }
  if (presets.crops3d && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.schematicFarm) {
    return `${loaderPrefix}-crops3d-${gameVersion}`;
  }
  if (presets.schematicFarm && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.sodium && !presets.sodiumExtra) {
    return `${loaderPrefix}-schematic-${gameVersion}`;
  }
  if (presets.sodiumExtra && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm && !presets.sodium) {
    return `${loaderPrefix}-sodiumextra-${gameVersion}`;
  }
  if (presets.sodium && !presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm && !presets.sodiumExtra) {
    return `${loaderPrefix}-sodium-${gameVersion}`;
  }
  if (presets.shaderFps || presets.embossedBlocks || presets.voiceChat || presets.fullbrightUb || presets.betterLeaves || presets.glowingOres || presets.roundTrees || presets.crops3d || presets.schematicFarm || presets.sodium || presets.sodiumExtra) {
    return `${loaderPrefix}-shader-${gameVersion}`;
  }
  return `${loaderPrefix}-shader-${gameVersion}`;
}

function cleanupStaleShaderPacks(shaderpacksDir, activeSlug) {
  if (!fs.existsSync(shaderpacksDir)) return;
  const keepName = shaderPackLocalName(activeSlug);
  for (const entry of fs.readdirSync(shaderpacksDir)) {
    if (!entry.toLowerCase().endsWith('.zip')) continue;
    if (entry === keepName) continue;
    const lower = entry.toLowerCase();
    const isKnown = [...KNOWN_SHADER_SLUGS].some((s) => lower === `${s}.zip`);
    if (isKnown || /Â§|Ã‚Â§/.test(entry)) {
      removeIfExists(path.join(shaderpacksDir, entry));
    }
  }
}

function isCorruptShaderPackName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  return /Â§|Ã‚Â§|\u00C2\u00A7|\\u00C2\\u00A7|LexBoosT/i.test(s);
}

function repairLegacyShaderPack({ gameRoot, shaderpacksDir, shaderSlug, activateFns }) {
  const slug = resolveShaderSlug(shaderSlug);
  const targetName = shaderPackLocalName(slug);
  const targetPath = path.join(shaderpacksDir, targetName);

  if (fs.existsSync(shaderpacksDir) && !fs.existsSync(targetPath)) {
    for (const entry of fs.readdirSync(shaderpacksDir)) {
      if (!entry.toLowerCase().endsWith('.zip')) continue;
      if (entry === targetName) continue;
      const lower = entry.toLowerCase();
      const slugHint = slug.replace(/-/g, '');
      if (
        isCorruptShaderPackName(entry) ||
        lower.includes(slugHint) ||
        (slug === 'astralex' && /astra|lexboost/i.test(lower))
      ) {
        fs.renameSync(path.join(shaderpacksDir, entry), targetPath);
        break;
      }
    }
  }

  for (const activate of activateFns) {
    activate({ gameRoot, shaderpackFilename: targetName });
  }

  const modsDir = path.join(gameRoot, 'mods');
  const bundle = readBundle(modsDir);
  if (!bundle) return targetName;
  const current = (bundle.shaderpacks || [])[0];
  if (current !== targetName || isCorruptShaderPackName(current)) {
    writeBundle(modsDir, {
      ...bundle,
      shaderSlug: slug,
      shaderpacks: fs.existsSync(targetPath) ? [targetName] : bundle.shaderpacks,
      updatedAt: Date.now(),
    });
  }
  return targetName;
}

function normalizePresets(p) {
  const shaderFps = !!(p && p.shaderFps);
  const sodiumExplicit = p && typeof p.sodium === 'boolean';
  return {
    shaderFps,
    embossedBlocks: !!(p && p.embossedBlocks),
    optifine: !!(p && p.optifine),
    voiceChat: !!(p && p.voiceChat),
    fullbrightUb: !!(p && p.fullbrightUb),
    betterLeaves: !!(p && p.betterLeaves),
    glowingOres: !!(p && p.glowingOres),
    roundTrees: !!(p && p.roundTrees),
    crops3d: !!(p && p.crops3d),
    schematicFarm: !!(p && p.schematicFarm),
    marsanaClientMenu: !!(p && p.marsanaClientMenu),
    clientHudPack: !!(p && p.clientHudPack),
    sodium: sodiumExplicit ? !!p.sodium : shaderFps,
    sodiumExtra: !!(p && p.sodiumExtra),
    // OptiFine paketi kendi optimizasyon modlarÄ±nÄ± getirir; ikisi birlikte Ã§ift jar Ã¼retir.
    // KullanÄ±cÄ±nÄ±n "Mod ekle" ile eklediÄŸi, bu seÃ§imde yÃ¼klenecek mod var.
    userMods: !!(p && p.userMods),
    fpsBoost: !!(p && p.fpsBoost && !p.optifine),
    fpsUnlimited: !!(p && p.fpsBoost && !p.optifine && p.fpsUnlimited),
  };
}

const STRICT_PATCH_MOD_SLUGS = new Set([
  ...CLIENT_HUD_REQUIRED_SLUGS,
  'sodium-extra',
  'iris',
  'sodium',
]);

// YalnÄ±zca Ã¶n sÃ¼rÃ¼mÃ¼ gÃ¼ncel olan modlar: Steam 'n' Rails 1.21.1 portunun son "release"i
// (0.2.1) eski kalÄ±yor, gÃ¼ncel iÃ§erik beta kanalÄ±nda yayÄ±nlanÄ±yor.
const PRERELEASE_MOD_SLUGS = new Set(['create-steam-n-rails-1.21.1']);

const OPTIONAL_LOADER_MOD_SLUGS = new Set([POLYTONE_SLUG, ...CLIENT_HUD_MOD_SLUGS]);

function usesStrictModrinthPatch(gameVersion) {
  const id = String(gameVersion || '').trim();
  return /^\d+\.\d+\.\d+$/.test(id) && !/^26\./.test(id);
}

function polytoneSupportedForGameVersion(gameVersion) {
  // Polytone Modrinth'te en fazla 1.21.11'e kadar; 26.x iÃ§in native jar yok.
  return !/^26\./.test(String(gameVersion || '').trim());
}

function fullbrightNeedsPolytone(p, gameVersion) {
  return !!(
    p.fullbrightUb &&
    p.shaderFps &&
    p.sodium &&
    !p.optifine &&
    polytoneSupportedForGameVersion(gameVersion)
  );
}

function betterLeavesNeedsCullLeaves(p) {
  // Better Leaves kaynak paketi tek baÅŸÄ±na yetmez; Cull Leaves (veya OptiFine Smart Leaves) gerekir.
  return !!(p.betterLeaves && !p.optifine);
}

function glowingOresNeedsContinuity(p) {
  return !!(p.glowingOres && !p.optifine && !p.embossedBlocks);
}

function sodiumExtraNeedsSodiumStack(p) {
  return !!(p.sodiumExtra && !p.sodium);
}

function modrinthSlugsForPresets(p, gameVersion) {
  if (p.optifine) {
    return [];
  }
  const out = [];
  const seen = new Set();
  const add = (slug) => {
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push(slug);
    }
  };
  if (p.shaderFps) SHADER_FPS_SLUGS.forEach(add);
  if (p.embossedBlocks) EMBOSSED_SLUGS.forEach(add);
  if (p.voiceChat) add(VOICE_CHAT_SLUG);
  if (fullbrightNeedsPolytone(p, gameVersion)) add(POLYTONE_SLUG);
  if (betterLeavesNeedsCullLeaves(p)) add(CULL_LEAVES_SLUG);
  if (glowingOresNeedsContinuity(p)) add(CONTINUITY_SLUG);
  if (p.clientHudPack) {
    for (const slug of CLIENT_HUD_REQUIRED_SLUGS) add(slug);
    for (const slug of CLIENT_HUD_MOD_SLUGS) add(slug);
  }
  if (p.schematicFarm || p.marsanaClientMenu || p.userMods) add('fabric-api');
  if (p.sodium) {
    add(SODIUM_SLUG);
    add('fabric-api');
  }
  if (p.sodiumExtra) {
    add(SODIUM_EXTRA_SLUG);
    if (sodiumExtraNeedsSodiumStack(p)) {
      add(SODIUM_SLUG);
      add('fabric-api');
    }
  }
  return out;
}

// OptiFine modpack'i Continuity gibi opsiyonel modlarÄ± `*.jar.disabled` olarak
// getiriyor. KullanÄ±cÄ± "kabartma" preset'ini de seÃ§tiyse bu modlarÄ± etkinleÅŸtir.
const OPTIFINE_EMBOSSED_MOD_PREFIXES = Object.freeze(['continuity']);

/** OptiFine mrpack eski surumle getirir; Modrinth'ten yeniden cekilir. */
const OPTIFINE_RECONCILE_SLUGS = Object.freeze([
  'krypton',
  'lithium',
  // Modrinth slug'i 'ferrite-core' (tireli); 'ferritecore' 404 verir. Zorunlu
  // bagimlilik degil, ama yanlis slug reconcile'in bundled jar'i silip geri
  // koyamamasina -> pack'in bellek optimizasyonu modunu kaybetmesine yol acar.
  'ferrite-core',
  'immediatelyfast',
  'modmenu',
  'dynamic-fps',
  'fabric-language-kotlin',
  // Modrinth slug'i 'forge-config-api-port'; 'forgeconfigapiport' 404 verir. Yanlis
  // slugla reconcile bundled jar'i siler ama yeniden indiremez -> rrls bagimliligini
  // kaybeder ve oyun "requires forgeconfigapiport, which is missing" ile coker.
  'forge-config-api-port',
]);

const OPTIFINE_RECONCILE_JAR_TESTS = Object.freeze({
  krypton: /^krypton-/i,
  lithium: /^lithium-fabric-/i,
  // Anahtar Modrinth slug'i; regex indirilen dosya adini test eder (ferritecore-8.1.0-fabric.jar).
  'ferrite-core': /^ferritecore-/i,
  immediatelyfast: /^immediatelyfast/i,
  modmenu: /^modmenu-/i,
  'dynamic-fps': /^dynamic[-_]?fps/i,
  'fabric-language-kotlin': /^fabric-language-kotlin/i,
  // Anahtar Modrinth slug'i; regex ise indirilen dosya adini test eder
  // (ForgeConfigAPIPort-v21.9.8+mc1.21.9-Fabric.jar -> forgeconfigapiport...).
  'forge-config-api-port': /^forgeconfigapiport/i,
});

/** OptiFine paketinde rrls vb. ile cakisan modlar â€” kaldirilir, yeniden indirilmez. */
const OPTIFINE_STRIP_JAR_TESTS = Object.freeze([
  /^dark-loading-screen/i,
  /^macos[-_]?input/i,
]);

function stripOptifineConflictingJars(modsDir, jars) {
  if (!fs.existsSync(modsDir)) {
    return Array.isArray(jars)
      ? jars.filter((name) => !OPTIFINE_STRIP_JAR_TESTS.some((re) => re.test(String(name).toLowerCase())))
      : [];
  }
  let out = Array.isArray(jars)
    ? jars.filter((name) => !OPTIFINE_STRIP_JAR_TESTS.some((re) => re.test(String(name).toLowerCase())))
    : [];
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar') && !entry.endsWith('.jar.disabled')) continue;
    if (!OPTIFINE_STRIP_JAR_TESTS.some((re) => re.test(entry.toLowerCase()))) continue;
    removeIfExists(path.join(modsDir, entry));
    out = out.filter((name) => name !== entry);
  }
  return out;
}

function enableOptifineEmbossedMods(modsDir) {
  if (!fs.existsSync(modsDir)) return [];
  const enabled = [];
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar.disabled')) continue;
    const lower = entry.toLowerCase();
    if (!OPTIFINE_EMBOSSED_MOD_PREFIXES.some((p) => lower.startsWith(p))) continue;
    const from = path.join(modsDir, entry);
    const to = path.join(modsDir, entry.slice(0, -'.disabled'.length));
    fs.renameSync(from, to);
    enabled.push(path.basename(to));
  }
  return enabled;
}

// Continuity'nin yan-yana baÄŸlÄ± doku (CTM) etkisi ancak built-in resource
// pack'leri Minecraft'Ä±n `options.txt` `resourcePacks` listesinde yer aldÄ±ÄŸÄ±nda
// gÃ¶rÃ¼nÃ¼r. Mod yokken Minecraft bu paketleri otomatik kaldÄ±rÄ±yor, mod tekrar
// yÃ¼klendiÄŸinde geri eklemiyor.
const CONTINUITY_PACKS = Object.freeze(['continuity:default', 'continuity:glass_pane_culling_fix']);

function ensureContinuityResourcePacks(gameRoot) {
  const optionsPath = path.join(gameRoot, 'options.txt');
  if (!fs.existsSync(optionsPath)) return;
  const original = fs.readFileSync(optionsPath, 'utf8');
  const match = original.match(/^resourcePacks:(.*)$/m);
  if (!match) return;
  let arr;
  try {
    arr = JSON.parse(match[1].trim());
  } catch {
    return;
  }
  if (!Array.isArray(arr)) return;
  const missing = CONTINUITY_PACKS.filter((p) => !arr.includes(p));
  if (missing.length === 0) return;
  const vanillaIdx = arr.indexOf('vanilla');
  const insertAt = vanillaIdx >= 0 ? vanillaIdx + 1 : 0;
  arr.splice(insertAt, 0, ...missing);
  const updated = original.replace(/^resourcePacks:.*$/m, `resourcePacks:${JSON.stringify(arr)}`);
  fs.writeFileSync(optionsPath, updated, 'utf8');
}

const MANAGED_MOD_RESOURCE_PACKS = Object.freeze([
  FULLBRIGHT_PACK_LOCAL_NAME,
  BETTER_LEAVES_PACK_LOCAL_NAME,
  GLOWING_ORES_PACK_LOCAL_NAME,
  CROPS_3D_PACK_LOCAL_NAME,
  ROUND_TREES_PACK_LOCAL_NAME,
]);

function managedModResourcePackEntries() {
  return MANAGED_MOD_RESOURCE_PACKS.map((name) => `file/${name}`);
}

function continuityResourcePacksNeeded(presets) {
  return !!(presets.embossedBlocks || glowingOresNeedsContinuity(presets));
}

function modResourcePackFilenamesForPresets(presets) {
  const files = [];
  if (presets.fullbrightUb) files.push(FULLBRIGHT_PACK_LOCAL_NAME);
  if (presets.betterLeaves) files.push(BETTER_LEAVES_PACK_LOCAL_NAME);
  if (presets.glowingOres) files.push(GLOWING_ORES_PACK_LOCAL_NAME);
  if (presets.crops3d) files.push(CROPS_3D_PACK_LOCAL_NAME);
  // Round Trees diÄŸer paketlerin Ã¼stÃ¼nde olmalÄ± (Modrinth Ã¶nerisi).
  if (presets.roundTrees) files.push(ROUND_TREES_PACK_LOCAL_NAME);
  return files;
}

function readPreservedUserResourcePacks(optionsPath) {
  if (!fs.existsSync(optionsPath)) return [];
  const match = fs.readFileSync(optionsPath, 'utf8').match(/^resourcePacks:(.*)$/m);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[1].trim());
    if (!Array.isArray(arr)) return [];
    const managed = new Set(['vanilla', ...CONTINUITY_PACKS, ...managedModResourcePackEntries()]);
    return arr.filter((entry) => !managed.has(entry));
  } catch {
    return [];
  }
}

function writeResourcePacksLine(optionsPath, entries) {
  const resourceLine = `resourcePacks:${JSON.stringify(entries)}`;
  if (!fs.existsSync(optionsPath)) {
    fs.writeFileSync(optionsPath, `${resourceLine}\n`, 'utf8');
    return;
  }
  const original = fs.readFileSync(optionsPath, 'utf8');
  if (/^resourcePacks:.*$/m.test(original)) {
    fs.writeFileSync(optionsPath, original.replace(/^resourcePacks:.*$/m, resourceLine), 'utf8');
    return;
  }
  const sep = original.endsWith('\n') || original.length === 0 ? '' : '\n';
  fs.writeFileSync(optionsPath, `${original}${sep}${resourceLine}\n`, 'utf8');
}

function applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir }) {
  let p = normalizePresets(presets);
  if (
    p.fullbrightUb &&
    !marsanaClientModService.isFeatureEnabled(
      gameRoot,
      marsanaClientModService.FULLBRIGHT_FEATURE_ID,
      true
    )
  ) {
    p = { ...p, fullbrightUb: false };
  }
  const files = modResourcePackFilenamesForPresets(p);
  const needContinuity = continuityResourcePacksNeeded(p);
  if (files.length === 0 && !needContinuity) return;

  const enabledFiles = [];
  for (const localName of files) {
    const zipPath = path.join(resourcepacksDir, localName);
    if (!fs.existsSync(zipPath)) continue;
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
    enabledFiles.push(localName);
  }

  const optionsPath = path.join(gameRoot, 'options.txt');
  const preserved = readPreservedUserResourcePacks(optionsPath);
  const entries = ['vanilla'];
  if (needContinuity) {
    for (const pack of CONTINUITY_PACKS) {
      if (!entries.includes(pack)) entries.push(pack);
    }
  }
  for (const localName of enabledFiles) {
    const entry = `file/${localName}`;
    if (!entries.includes(entry)) entries.push(entry);
  }
  for (const entry of preserved) {
    if (!entries.includes(entry)) entries.push(entry);
  }
  writeResourcePacksLine(optionsPath, entries);
  if (needContinuity) ensureContinuityResourcePacks(gameRoot);
}

function ensureFileResourcePackInOptions(gameRoot, filename) {
  const optionsPath = path.join(gameRoot, 'options.txt');
  const entry = `file/${filename}`;

  if (!fs.existsSync(optionsPath)) {
    fs.writeFileSync(
      optionsPath,
      `resourcePacks:["vanilla","${entry}"]\n`,
      'utf8'
    );
    return;
  }

  const original = fs.readFileSync(optionsPath, 'utf8');
  const match = original.match(/^resourcePacks:(.*)$/m);
  if (!match) {
    const sep = original.endsWith('\n') || original.length === 0 ? '' : '\n';
    fs.writeFileSync(optionsPath, `${original}${sep}resourcePacks:["vanilla","${entry}"]\n`, 'utf8');
    return;
  }
  let arr;
  try {
    arr = JSON.parse(match[1].trim());
  } catch {
    return;
  }
  if (!Array.isArray(arr)) return;
  if (arr.includes(entry)) return;
  const vanillaIdx = arr.indexOf('vanilla');
  const insertAt = vanillaIdx >= 0 ? vanillaIdx + 1 : 0;
  arr.splice(insertAt, 0, entry);
  const updated = original.replace(/^resourcePacks:.*$/m, `resourcePacks:${JSON.stringify(arr)}`);
  fs.writeFileSync(optionsPath, updated, 'utf8');
}

function clothConfigJarPresent(modsDir) {
  return hudDepsService.clothConfigJarPresent(modsDir);
}

function bundleListsIncompatibleManagedJars(jars, gameVersion) {
  if (!Array.isArray(jars)) return false;
  return jars.some(
    (name) =>
      modCompatibilityService.isManagedModFamilyJar(name) &&
      modCompatibilityService.isJarFilenameIncompatibleWithGame(name, gameVersion)
  );
}

function refreshManagedJarEntries(jars, modsDir, gameVersion) {
  let out = Array.isArray(jars) ? jars.filter(
    (name) =>
      !modCompatibilityService.isManagedModFamilyJar(name) ||
      modCompatibilityService.jarVersionMatchesGame(name, gameVersion)
  ) : [];
  if (!fs.existsSync(modsDir)) return out;
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar') || entry.endsWith('.jar.disabled')) continue;
    if (!modCompatibilityService.isManagedModFamilyJar(entry)) continue;
    if (!modCompatibilityService.jarVersionMatchesGame(entry, gameVersion)) continue;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}

function clientHudDependenciesOk(modsDir, modPresets) {
  if (!modPresets) return true;
  return hudDepsService.fabricHudRuntimeDepsOk(modsDir, {
    clientHudPack: !!modPresets.clientHudPack,
  });
}

function presetsMatch(saved, wanted) {
  if (
    !saved ||
    typeof saved.shaderFps !== 'boolean' ||
    typeof saved.embossedBlocks !== 'boolean' ||
    typeof saved.optifine !== 'boolean' ||
    typeof saved.voiceChat !== 'boolean' ||
    typeof saved.fullbrightUb !== 'boolean' ||
    typeof saved.betterLeaves !== 'boolean' ||
    typeof saved.glowingOres !== 'boolean' ||
    typeof saved.roundTrees !== 'boolean' ||
    typeof saved.crops3d !== 'boolean' ||
    typeof saved.schematicFarm !== 'boolean' ||
    typeof saved.marsanaClientMenu !== 'boolean' ||
    typeof saved.clientHudPack !== 'boolean' ||
    typeof saved.sodium !== 'boolean' ||
    typeof saved.sodiumExtra !== 'boolean'
  ) {
    return false;
  }
  return (
    saved.shaderFps === wanted.shaderFps &&
    saved.embossedBlocks === wanted.embossedBlocks &&
    saved.optifine === wanted.optifine &&
    saved.voiceChat === wanted.voiceChat &&
    saved.fullbrightUb === wanted.fullbrightUb &&
    saved.betterLeaves === wanted.betterLeaves &&
    saved.glowingOres === wanted.glowingOres &&
    saved.roundTrees === wanted.roundTrees &&
    saved.crops3d === wanted.crops3d &&
    saved.schematicFarm === wanted.schematicFarm &&
    saved.marsanaClientMenu === wanted.marsanaClientMenu &&
    saved.clientHudPack === wanted.clientHudPack &&
    saved.sodium === wanted.sodium &&
    saved.sodiumExtra === wanted.sodiumExtra &&
    // Eski bundle'larda alan yok; yok = kapalÄ±.
    !!saved.fpsBoost === !!wanted.fpsBoost &&
    !!saved.userMods === !!wanted.userMods
  );
}

function readBundle(modsDir) {
  const p = path.join(modsDir, BUNDLE_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeBundle(modsDir, data) {
  fs.writeFileSync(path.join(modsDir, BUNDLE_FILE), JSON.stringify(data, null, 2), 'utf8');
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function allFilesExist(base, names) {
  if (!Array.isArray(names)) return true;
  return names.every((n) => n && fs.existsSync(path.join(base, n)));
}

function statusEmitter(emit) {
  return (text) => emit && emit.status && emit.status({ text });
}

function createShaderStackService({ httpClient, fabricInstaller, modrinthClient, mrpackInstaller, repoRoot }) {
  function ensureClothConfigForHud({ modsDir, gameVersion, status, jars }) {
    hudDepsService.recoverFabricModsFromMisstash(modsDir, gameVersion);
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    hudDepsService.reenableClothConfigJar(modsDir);
    let out = Array.isArray(jars) ? jars.slice() : [];
    if (repoRoot) {
      const bundled = hudDepsService.installBundledClothConfig({
        repoRoot,
        modsDir,
        gameVersion,
        onNotice: status,
      });
      if (bundled && !out.includes(bundled)) out.push(bundled);
    }
    return out;
  }

  async function ensureHudRuntimeDepsAsync({ modsDir, gameVersion, status, jars, presets }) {
    let out = ensureClothConfigForHud({ modsDir, gameVersion, status, jars });
    const clientHudPack = !!(presets && presets.clientHudPack);
    if (!hudDepsService.fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack })) return out;

    const slugsToFetch = [];
    if (
      !hudDepsService.fabricKotlinJarPresent(modsDir) &&
      (clientHudPack || hudDepsService.kotlinRuntimeDepNeeded(modsDir))
    ) {
      slugsToFetch.push('fabric-language-kotlin');
    }
    if (
      !hudDepsService.modmenuJarPresent(modsDir) &&
      (clientHudPack || hudDepsService.modmenuRuntimeDepNeeded(modsDir))
    ) {
      slugsToFetch.push('modmenu');
    }
    if (clientHudPack && !clothConfigJarPresent(modsDir)) {
      slugsToFetch.push('cloth-config');
    }

    if (slugsToFetch.length > 0) {
      const requiredJars = await downloadModsFromSlugs({
        modsDir,
        gameVersion,
        slugs: [...new Set(slugsToFetch)],
      });
      out = [...new Set([...out, ...requiredJars])];
    }

    if (!hudDepsService.fabricHudRuntimeDepsOk(modsDir, { clientHudPack })) {
      const missing = [];
      if (
        (clientHudPack || hudDepsService.kotlinRuntimeDepNeeded(modsDir)) &&
        !hudDepsService.fabricKotlinJarPresent(modsDir)
      ) {
        missing.push('fabric-language-kotlin');
      }
      if (
        (clientHudPack || hudDepsService.modmenuRuntimeDepNeeded(modsDir)) &&
        !hudDepsService.modmenuJarPresent(modsDir)
      ) {
        missing.push('modmenu');
      }
      if (clientHudPack && !clothConfigJarPresent(modsDir)) missing.push('cloth-config');
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Fabric calisma modlari kurulamadi (${missing.join(', ')}). Internet baglantinizi kontrol edip tekrar deneyin.`
      );
    }
    return out;
  }

  async function ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars }) {
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    let out = Array.isArray(jars) ? jars.slice() : [];
    const need = [];

    if (presets.shaderFps && !presets.optifine) {
      if (!modCompatibilityService.coreIrisJarPresent(modsDir, gameVersion)) need.push('iris');
    }
    if (presets.sodium && !presets.optifine) {
      if (!modCompatibilityService.coreSodiumJarPresent(modsDir, gameVersion)) need.push(SODIUM_SLUG);
    }
    if (presets.sodiumExtra && !modCompatibilityService.sodiumExtraJarPresent(modsDir, gameVersion)) {
      need.push(SODIUM_EXTRA_SLUG);
    }
    if (sodiumExtraNeedsSodiumStack(presets) && !modCompatibilityService.coreSodiumJarPresent(modsDir, gameVersion)) {
      need.push(SODIUM_SLUG);
    }
    if (continuityResourcePacksNeeded(presets)) {
      if (!modCompatibilityService.continuityJarPresent(modsDir, gameVersion)) need.push('continuity');
    }

    if (need.length) {
      status(`Mod cekirdegi guncelleniyor (${need.join(', ')})...`);
      const coreJars = await downloadModsFromSlugs({ modsDir, gameVersion, slugs: need });
      out = [...new Set([...out, ...coreJars])];
    }

    const hasFabricApi = fs.existsSync(modsDir) &&
      fs.readdirSync(modsDir).some(
        (f) => /^fabric-api/i.test(f) && f.endsWith('.jar') && modCompatibilityService.jarVersionMatchesGame(f, gameVersion)
      );
    if ((presets.shaderFps || presets.embossedBlocks || presets.glowingOres || presets.sodium || sodiumExtraNeedsSodiumStack(presets)) && !hasFabricApi) {
      status('Fabric API eksik, indiriliyor...');
      const apiJars = await downloadModsFromSlugs({ modsDir, gameVersion, slugs: ['fabric-api'] });
      out = [...new Set([...out, ...apiJars])];
    }

    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    return out;
  }

  async function ensureOptifineReconciledMods({ modsDir, gameVersion, status, jars }) {
    if (!fs.existsSync(modsDir)) return Array.isArray(jars) ? jars.slice() : [];
    let out = Array.isArray(jars) ? jars.slice() : [];
    const slugsToRefresh = [];

    for (const slug of OPTIFINE_RECONCILE_SLUGS) {
      const test = OPTIFINE_RECONCILE_JAR_TESTS[slug];
      if (!test) continue;
      const hasFamilyJar = fs.readdirSync(modsDir).some(
        (f) => test.test(f) && (f.endsWith('.jar') || f.endsWith('.jar.disabled'))
      );
      if (!hasFamilyJar) continue;
      modCompatibilityService.removeModFamilyJars(modsDir, (f) => test.test(f));
      slugsToRefresh.push(slug);
      out = out.filter((name) => !test.test(String(name)));
    }

    if (!slugsToRefresh.length) return out;

    status(`OptiFine paketi modlari guncelleniyor (${slugsToRefresh.join(', ')})...`);
    const fresh = [];
    for (const slug of slugsToRefresh) {
      try {
        const jars = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [slug],
        });
        fresh.push(...jars);
      } catch {
        /* OptiFine paketindeki yardimci mod bu surumde yoksa atla â€” kirli jar zaten silindi */
      }
    }
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    return [...new Set([...out, ...fresh])];
  }

  async function ensureOptifineZoomify({ modsDir, gameVersion, status, jars }) {
    if (!/^26\./.test(String(gameVersion || '').trim())) return Array.isArray(jars) ? jars.slice() : [];
    let out = Array.isArray(jars) ? jars.slice() : [];
    const hasZoomify = fs.existsSync(modsDir) &&
      fs.readdirSync(modsDir).some((f) => /^zoomify/i.test(f) && f.endsWith('.jar'));
    if (hasZoomify) return out;
    status('Zoom (C) iÃ§in Zoomify kuruluyor â€” resmi OptiFine 26.x henÃ¼z yok.');
    try {
      const fresh = await downloadModsFromSlugs({ modsDir, gameVersion, slugs: ['zoomify'] });
      out = [...new Set([...out, ...fresh])];
    } catch {
      /* optional */
    }
    return out;
  }

  async function finalizeOptifineModState({ modsDir, gameVersion, status, jars, presets }) {
    if (!presets || !presets.optifine) return Array.isArray(jars) ? jars.slice() : [];
    let out = stripOptifineConflictingJars(modsDir, jars);
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    out = await ensureOptifineReconciledMods({
      modsDir,
      gameVersion,
      status,
      jars: out,
    });
    out = stripOptifineConflictingJars(modsDir, out);
    out = await ensureOptifineZoomify({ modsDir, gameVersion, status, jars: out });
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    return refreshManagedJarEntries(out, modsDir, gameVersion);
  }

  function cachedReady({ versionDir, modsDir, shaderpacksDir, resourcepacksDir, gameVersion, versionJsonPath, readyPath, modPresets, shaderSlug }) {
    const existing = readBundle(modsDir);
    const wantsShader = modPresets.shaderFps && !modPresets.optifine;
    const expectedSlug = wantsShader ? resolveShaderSlug(shaderSlug) : null;
    const expectedPack = wantsShader ? shaderPackLocalName(expectedSlug) : null;
    if (
      !existing ||
      (existing.bundleVersion || 1) < SHADER_BUNDLE_VERSION ||
      !presetsMatch(existing.presets, modPresets) ||
      !fs.existsSync(versionJsonPath) ||
      !fs.existsSync(readyPath) ||
      existing.gameVersion !== gameVersion ||
      (wantsShader && existing.shaderSlug !== expectedSlug) ||
      (expectedPack && (existing.shaderpacks || [])[0] !== expectedPack) ||
      !allFilesExist(modsDir, existing.jars) ||
      !allFilesExist(shaderpacksDir, existing.shaderpacks || []) ||
      !allFilesExist(resourcepacksDir, existing.resourcepacks || []) ||
      (existing.shaderpacks || []).some((name) => /Â§/.test(String(name))) ||
      !clientHudDependenciesOk(modsDir, modPresets) ||
      (modPresets.marsanaClientMenu &&
        repoRoot &&
        marsanaClientModService.bundledJarAvailable(repoRoot, gameVersion) &&
        !marsanaClientModService.marsanaClientJarPresent(modsDir)) ||
      (modPresets.schematicFarm &&
        repoRoot &&
        schematicFarmModService.bundledJarAvailable(repoRoot, gameVersion) &&
        !schematicFarmModService.schematicFarmJarPresent(modsDir)) ||
      (modPresets.sodium &&
        !modPresets.optifine &&
        !modCompatibilityService.coreSodiumJarPresent(modsDir, gameVersion)) ||
      (modPresets.shaderFps &&
        !modPresets.optifine &&
        !modCompatibilityService.coreIrisJarPresent(modsDir, gameVersion)) ||
      (modPresets.sodiumExtra &&
        !modCompatibilityService.sodiumExtraJarPresent(modsDir, gameVersion)) ||
      (continuityResourcePacksNeeded(modPresets) &&
        !modCompatibilityService.continuityJarPresent(modsDir, gameVersion)) ||
      bundleListsIncompatibleManagedJars(existing.jars, gameVersion) ||
      (!modPresets.clientHudPack &&
        !modPresets.marsanaClientMenu &&
        modIsolationService.activeClientPackJarsPresent(modsDir, modPresets)) ||
      (!polytoneSupportedForGameVersion(gameVersion) &&
        (existing.jars || []).some((name) => /^polytone/i.test(String(name))))
    ) {
      return null;
    }
    let assetIndexId = existing.assetIndexId;
    if (!assetIndexId) {
      try {
        const merged = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        assetIndexId = merged.assetIndex?.id || gameVersion;
      } catch {
        assetIndexId = gameVersion;
      }
    }
    return {
      customId: customIdFor(gameVersion, modPresets, shaderSlug),
      assetIndexId,
      shaderpacks: existing.shaderpacks || [],
    };
  }

  async function installFabricProfile({ gameVersion, customId, versionDir, versionJsonPath, fabricChannel = 'stable' }) {
    const { merged, loaderVersion } = await fabricInstaller.buildMergedProfile(gameVersion, {
      channel: fabricChannel,
    });
    merged.id = customId;
    await fs.promises.mkdir(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(merged, null, 2), 'utf8');
    return { merged, loaderVersion };
  }

  // MCLC, Minecraft 1.21+'in numerik asset index ID'sini (Ã¶rn. "30") gameVersion
  // adÄ±yla kaydedebiliyor; sonuÃ§ olarak oyun aradÄ±ÄŸÄ± `<id>.json`'u bulamayÄ±p
  // panorama, diller ve sesleri yÃ¼kleyemiyor. Eksikse Mojang'dan indirip
  // doÄŸru isimle yerleÅŸtir.
  async function ensureAssetIndexFile({ gameRoot, assetIndex }) {
    if (!assetIndex || !assetIndex.id || !assetIndex.url) return;
    const indexesDir = path.join(gameRoot, 'assets', 'indexes');
    await fs.promises.mkdir(indexesDir, { recursive: true });
    // assetIndex.id uzak Mojang JSON'undan geliyor; dosya adÄ±na doÄŸrudan gÃ¶mÃ¼lÃ¼yor.
    const targetPath = assertInside(
      indexesDir,
      `${assetIndex.id}.json`,
      `Asset index adÄ± gÃ¼venli deÄŸil: "${assetIndex.id}".`
    );
    if (fs.existsSync(targetPath)) return;
    await httpClient.download(assetIndex.url, targetPath, {
      sha1: assetIndex.sha1,
      size: assetIndex.size,
    });
  }

  function cleanupPreviousBundle({ modsDir, shaderpacksDir, resourcepacksDir }) {
    const prev = readBundle(modsDir);
    if (!prev) return;
    for (const jar of prev.jars || []) removeIfExists(path.join(modsDir, jar));
    for (const pack of prev.shaderpacks || []) removeIfExists(path.join(shaderpacksDir, pack));
    for (const pack of prev.resourcepacks || []) removeIfExists(path.join(resourcepacksDir, pack));
  }

  // Mojang'Ä±n base sÃ¼rÃ¼mleri (1.20, 1.21, 1.19) iÃ§in mod ekosistemi genelde
  // patch sÃ¼rÃ¼mÃ¼nÃ¼ (1.20.1, 1.21.1, ...) hedefler â€” base'ten ilk patch'e mod
  // gÃ¼ncellemesi gelir. Anchor sorgusunu expand edersek Modrinth daha gÃ¼ncel ve
  // birbiriyle uyumlu sÃ¼rÃ¼mleri dÃ¶ner.
  function expandGameVersion(v) {
    return modrinthGameVersionCandidates(v);
  }

  function expandLoaderModGameVersion(v) {
    return modrinthLoaderModGameVersionCandidates(v);
  }

  function removeIncompatiblePolytoneJars(modsDir, gameVersion) {
    if (polytoneSupportedForGameVersion(gameVersion) || !fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      if (/^polytone.*\.jar$/i.test(entry)) {
        removeIfExists(path.join(modsDir, entry));
      }
    }
  }

  // Modlar arasÄ± "latest" sÃ¼rÃ¼mler bazen birbiriyle uyumsuz olabilir (Ã¶rn. Iris
  // 1.6.11 Modrinth manifest'inde Sodium 0.5.7'yi gÃ¶sterir ama jar iÃ§indeki
  // breaks Sodium >=0.5.7'yi Ã§akÄ±ÅŸmalÄ± sayar). Ã‡Ã¶zÃ¼m katmanlarÄ±:
  //  - gameVersion'Ä± patch ile expand et â€” yeni anchor'lar gelir.
  //  - Anchor mod (Iris/Continuity) Ã¶nce Ã§ek.
  //  - Anchor'Ä±n Modrinth `dependencies` listesindeki spesifik `version_id`'leri
  //    indir; null ise anchor'Ä±n yayÄ±n tarihinden Ã¶nceki en son uyumlu sÃ¼rÃ¼mÃ¼
  //    al (contemporary heuristic).
  //  - AynÄ± projenin tekrar indirilmesini engellemek iÃ§in downloaded set tutulur.
  // skipExisting: diskte aynÄ± boyutta jar varsa yeniden indirme (her aÃ§Ä±lÄ±ÅŸta ~50 MB'lÄ±k
  // paketi Ã§ekmemek iÃ§in). optionalSlugs: bu slug'lar iÃ§in uygun sÃ¼rÃ¼m yoksa atla.
  async function downloadModsFromSlugs({ modsDir, gameVersion, slugs, modrinthLoaders, skipExisting = false, optionalSlugs = null }) {
    const loaderFilter = Array.isArray(modrinthLoaders) && modrinthLoaders.length
      ? modrinthLoaders
      : ['fabric'];
    const isMc26 = /^26\./.test(String(gameVersion));
    await fs.promises.mkdir(modsDir, { recursive: true });
    removeIncompatiblePolytoneJars(modsDir, gameVersion);
    const jars = [];
    const downloadedVersionIds = new Set();
    const downloadedProjectIds = new Set();

    async function findContemporaryVersion(projectId, anchorPublishedIso, { strictPatch = false } = {}) {
      const anchorTs = Date.parse(anchorPublishedIso || '') || Date.now();
      const candidates = expandLoaderModGameVersion(gameVersion);
      const pickOpts = { anchorTs, gameVersion, gameVersionCandidates: candidates };
      const strictList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
        gameVersions: candidates,
      });
      const strictPick = pickNewestModrinthVersion(strictList, { ...pickOpts, strictPatch });
      if (strictPick) return strictPick;

      if (isMc26) return null;

      if (/^\d+\.\d+\.\d+$/.test(String(gameVersion))) {
        return null;
      }

      const looseList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
      });
      return pickNewestModrinthVersion(looseList, { ...pickOpts, strictPatch: false });
    }

    async function persistVersion(version) {
      if (!version || downloadedVersionIds.has(version.id)) return;
      const file = modrinthClient.primaryFileOf(version);
      if (!file) return;
      downloadedVersionIds.add(version.id);
      if (version.project_id) downloadedProjectIds.add(version.project_id);
      // file.filename Modrinth'ten geliyor; yol bileÅŸeni iÃ§erebilir. mrpackInstaller
      // aynÄ± alanda path.basename uyguluyor â€” burada da modsDir dÄ±ÅŸÄ±na Ã§Ä±kÄ±ÅŸÄ± engelle.
      const safeName = path.basename(String(file.filename || ''));
      if (!safeName) return;
      const destPath = assertInside(modsDir, safeName);
      let alreadyThere = false;
      if (skipExisting) {
        try {
          alreadyThere = fs.statSync(destPath).size === Number(file.size);
        } catch {
          alreadyThere = false;
        }
      }
      if (!alreadyThere) {
        await httpClient.download(file.url, destPath, modrinthClient.fileIntegrity(file));
      }
      jars.push(safeName);

      for (const dep of version.dependencies || []) {
        if (dep.dependency_type !== 'required') continue;
        if (dep.project_id && downloadedProjectIds.has(dep.project_id)) continue;
        let depVersion = null;
        if (dep.version_id) {
          depVersion = await modrinthClient.versionById(dep.version_id);
          const depOk = isMc26
            ? versionMatchesLoaderModGame(depVersion, gameVersion)
            : versionMatchesGameForFetch(depVersion, gameVersion, { strictPatch: true });
          if (depVersion && !depOk && dep.project_id) {
            const override = await findContemporaryVersion(dep.project_id, version.date_published, {
              strictPatch: true,
            });
            if (override) depVersion = override;
          }
        } else if (dep.project_id) {
          depVersion = await findContemporaryVersion(dep.project_id, version.date_published);
        }
        if (
          depVersion &&
          isMc26 &&
          !versionMatchesLoaderModGame(depVersion, gameVersion)
        ) {
          depVersion = null;
        }
        if (depVersion) await persistVersion(depVersion);
      }
    }

    for (const slug of slugs) {
      let version;
      try {
        const candidates = expandLoaderModGameVersion(gameVersion);
        let versions = await modrinthClient.listProjectVersions(slug, {
          loaders: loaderFilter,
          gameVersions: candidates,
        });
        if (versions.length === 0 && isMc26) {
          versions = await modrinthClient.listProjectVersions(slug, { loaders: loaderFilter });
        }
        version = pickNewestModrinthVersion(versions, {
          gameVersion,
          gameVersionCandidates: candidates,
          strictPatch: usesStrictModrinthPatch(gameVersion) || STRICT_PATCH_MOD_SLUGS.has(slug),
          allowPrerelease: PRERELEASE_MOD_SLUGS.has(slug),
        });
        if (!version) {
          if (OPTIONAL_LOADER_MOD_SLUGS.has(slug) || (optionalSlugs && optionalSlugs.has(slug))) continue;
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Modrinth: "${slug}" iÃ§in uygun sÃ¼rÃ¼m bulunamadÄ±.`
          );
        }
      } catch (err) {
        if (OPTIONAL_LOADER_MOD_SLUGS.has(slug) || (optionalSlugs && optionalSlugs.has(slug))) continue;
        if (err && err.code === Codes.MODRINTH_NOT_FOUND) {
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Bu Minecraft sÃ¼rÃ¼mÃ¼ (${gameVersion}) iÃ§in "${slug}" modunun ${loaderFilter.join('/')} uyumlu sÃ¼rÃ¼mÃ¼ Modrinth'te yok. ` +
              'Snapshot/henÃ¼z yayÄ±nlanmamÄ±ÅŸ sÃ¼rÃ¼mlerde bu modlar olmaz â€” stable bir release (Ã¶rn. 1.21.4, 1.20.1) seÃ§in.'
          );
        }
        throw err;
      }
      if (version.project_id && downloadedProjectIds.has(version.project_id)) continue;
      await persistVersion(version);
    }
    return jars;
  }

  async function downloadShaderPack({ shaderpacksDir, gameVersion, loaders, shaderSlug, onNotice }) {
    const expanded = (function expand(v) {
      const s = String(v);
      if (/^26\./.test(s)) return [s];
      const m = s.match(/^1\.(\d+)$/);
      return m ? [s, `${s}.1`] : [s];
    })(gameVersion);
    const loaderFilter = Array.isArray(loaders) && loaders.length ? loaders : ['iris'];
    const slug = resolveShaderSlug(shaderSlug);

    const queryAttempts = [
      { loaders: loaderFilter, gameVersions: expanded },
      { loaders: loaderFilter },
      { gameVersions: expanded },
      {},
    ];

    let lastErr = null;
    for (const query of queryAttempts) {
      try {
        const file = await modrinthClient.latestPrimaryFile(slug, query);
        const safeName = shaderPackLocalName(slug);
        cleanupStaleShaderPacks(shaderpacksDir, slug);
        await fs.promises.mkdir(shaderpacksDir, { recursive: true });
        await httpClient.download(file.url, path.join(shaderpacksDir, safeName), modrinthClient.fileIntegrity(file));
        if (onNotice) {
          onNotice(`Shader paketi hazÄ±r: ${safeName}`);
        }
        return [safeName];
      } catch (err) {
        lastErr = err;
        if (!isModrinthNotFound(err)) break;
      }
    }

    if (slug !== DEFAULT_SHADER_SLUG && isModrinthNotFound(lastErr)) {
      if (onNotice) {
        onNotice(
          `"${slug}" bu Minecraft sÃ¼rÃ¼mÃ¼nde bulunamadÄ± â€” Complementary Reimagined kullanÄ±lÄ±yor.`
        );
      }
      try {
        const fallback = await modrinthClient.latestPrimaryFile(DEFAULT_SHADER_SLUG, {
          loaders: loaderFilter,
          gameVersions: expanded,
        });
        const safeName = shaderPackLocalName(DEFAULT_SHADER_SLUG);
        cleanupStaleShaderPacks(shaderpacksDir, DEFAULT_SHADER_SLUG);
        await fs.promises.mkdir(shaderpacksDir, { recursive: true });
        await httpClient.download(fallback.url, path.join(shaderpacksDir, safeName), modrinthClient.fileIntegrity(fallback));
        return [safeName];
      } catch {
        return [];
      }
    }

    if (lastErr) throw lastErr;
    return [];
  }

  // Iris shader paketi otomatik aktivasyonu: indirilen pack zaten varsa kullanÄ±cÄ±nÄ±n
  // Options â†’ Video â†’ Shader Packs menÃ¼sÃ¼ne girip seÃ§mesi gerekmesin. Iris ilk aÃ§Ä±lÄ±ÅŸta
  // boÅŸ bir `shaderPack=` yazÄ±yor; mevcut satÄ±rÄ± (varsa) gÃ¼ncelle, yoksa ekle.
  function writeShaderPropertiesFile(propsPath, shaderpackFilename) {
    let body = '';
    if (fs.existsSync(propsPath)) {
      body = fs.readFileSync(propsPath, 'utf8');
    } else {
      fs.mkdirSync(path.dirname(propsPath), { recursive: true });
    }
    const lines = body ? body.split(/\r?\n/) : [];
    let touchedPack = false;
    let touchedEnable = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^shaderPack\s*=/.test(lines[i])) {
        lines[i] = `shaderPack=${shaderpackFilename}`;
        touchedPack = true;
      } else if (/^enableShaders\s*=/.test(lines[i])) {
        lines[i] = 'enableShaders=true';
        touchedEnable = true;
      }
    }
    if (!touchedPack) lines.push(`shaderPack=${shaderpackFilename}`);
    if (!touchedEnable) lines.push('enableShaders=true');
    fs.writeFileSync(propsPath, `${lines.join('\n')}\n`, 'utf8');
  }

  function activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'iris.properties'), shaderpackFilename);
  }

  // Oculus (Iris'in Forge/NeoForge fork'u) kendi config dosyasÄ±nÄ± kullanÄ±r:
  // `config/oculus.properties`. Format Iris ile aynÄ±.
  function activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'oculus.properties'), shaderpackFilename);
  }

  // OptiFine'Ä±n shader config dosyasÄ± ayrÄ±: `optionsshaders.txt`. Format ana
  // options.txt'e benzer ama OptiFine bunu shader pack seÃ§imi iÃ§in okur.
  function deactivateShaderConfig(gameRoot) {
    for (const name of ['iris.properties', 'oculus.properties']) {
      const propsPath = path.join(gameRoot, 'config', name);
      if (!fs.existsSync(propsPath)) continue;
      const lines = fs.readFileSync(propsPath, 'utf8').split(/\r?\n/);
      let touchedEnable = false;
      let touchedPack = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^enableShaders\s*=/.test(lines[i])) {
          lines[i] = 'enableShaders=false';
          touchedEnable = true;
        } else if (/^shaderPack\s*=/.test(lines[i])) {
          lines[i] = 'shaderPack=';
          touchedPack = true;
        }
      }
      if (!touchedEnable) lines.push('enableShaders=false');
      if (!touchedPack) lines.push('shaderPack=');
      fs.writeFileSync(propsPath, `${lines.join('\n')}\n`, 'utf8');
    }
  }

  function activateShaderPackInOptifineConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    const optionsPath = path.join(gameRoot, 'optionsshaders.txt');
    let body = '';
    if (fs.existsSync(optionsPath)) body = fs.readFileSync(optionsPath, 'utf8');
    const lines = body ? body.split(/\r?\n/) : [];
    let touched = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^shaderPack:/.test(lines[i])) {
        lines[i] = `shaderPack:${shaderpackFilename}`;
        touched = true;
        break;
      }
    }
    if (!touched) lines.push(`shaderPack:${shaderpackFilename}`);
    fs.writeFileSync(optionsPath, lines.join('\n'), 'utf8');
  }

  // Forge / NeoForge iÃ§in launch Ã¶ncesi eski shader mod jar'larÄ±nÄ± temizle.
  // AynÄ± kategoride iki sÃ¼rÃ¼m (Ã¶rn. Rubidium + Embeddium ya da Oculus + Iris)
  // duplicate hatasÄ± verir â€” sÄ±fÄ±rdan kuruyoruz ki tutarlÄ± kombinasyon olsun.
  //
  // Ã–NEMLÄ°: hem aktif `.jar` hem stash kopyalarÄ±nÄ± siliyoruz. Aksi halde
  // applyLoaderModsState bir sonraki loader geÃ§iÅŸinde eski stash'i restore
  // edip eski Rubidium'u geri getirir ve yeni Embeddium ile Ã§akÄ±ÅŸÄ±r.
  const FORGE_FAMILY_SHADER_PREFIXES = ['oculus', 'rubidium', 'embeddium', 'iris', 'sodium'];
  function cleanupForgeFamilyShaderJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_FAMILY_SHADER_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  // Forge ailesinde kabartma iÃ§in yÃ¶netilen jar'lar: Continuity (Forge/NeoForge).
  const FORGE_FAMILY_EMBOSSED_PREFIXES = ['continuity'];
  function cleanupForgeFamilyEmbossedJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_FAMILY_EMBOSSED_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  async function installShadersForExternalLoader({ loader, gameRoot, gameVersion, emit, shaderSlug }) {
    const modsDir = path.join(gameRoot, 'mods');
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const status = statusEmitter(emit);
    const resolvedSlug = resolveShaderSlug(shaderSlug);

    repairLegacyShaderPack({
      gameRoot,
      shaderpacksDir,
      shaderSlug: resolvedSlug,
      activateFns: [
        activateShaderPackInIrisConfig,
        activateShaderPackInOculusConfig,
      ],
    });

    // Eski shader mod kombinasyonlarÄ±nÄ± temizle â€” duplicate riskini Ã¶nler.
    if (loader === 'forge' || loader === 'neoforge') {
      cleanupForgeFamilyShaderJars(modsDir);
    }

    if (loader === 'forge-optifine') {
      status('Shader paketi indiriliyor (OptiFine iÃ§in)...');
      const packs = await downloadShaderPack({
        shaderpacksDir,
        gameVersion,
        loaders: ['optifine', 'iris'],
        shaderSlug,
        onNotice: status,
      });
      if (packs[0]) {
        activateShaderPackInOptifineConfig({ gameRoot, shaderpackFilename: packs[0] });
      }
      return { jars: [], shaderpacks: packs };
    }

    // Anchor mod yeterli â€” Modrinth'in `dependencies` listesi Sodium/Embeddium
    // gibi gerekli baÄŸÄ±mlÄ±lÄ±klarÄ± zaten getiriyor. Ek slug yazarsak bir
    // projenin iki sÃ¼rÃ¼mÃ¼nÃ¼ (Ã¶rn. Rubidium + Embeddium) yan yana indirebiliriz
    // ve Forge bunu "duplicate mod" diye reddeder.
    const SLUGS_BY_LOADER = {
      forge: ['oculus'],
      neoforge: ['iris'],
      quilt: ['iris'],
    };
    const slugs = SLUGS_BY_LOADER[loader];
    if (!slugs) {
      throw new Error(`installShadersForExternalLoader: desteklenmeyen loader: ${loader}`);
    }

    status(`Shader modlarÄ± indiriliyor (${loader})...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs,
      modrinthLoaders: [loader],
    });

    status('Shader paketi indiriliyor...');
    const packs = await downloadShaderPack({
      shaderpacksDir,
      gameVersion,
      loaders: ['iris'], // Oculus de Iris API'sini kullanÄ±r, aynÄ± paket
      shaderSlug,
      onNotice: status,
    });
    if (packs[0]) {
      if (loader === 'forge') {
        // Oculus kendi config dosyasÄ±nÄ± okur (oculus.properties), iris.properties deÄŸil.
        activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename: packs[0] });
      } else {
        // NeoForge ve Quilt: gerÃ§ek Iris mod'u â†’ iris.properties
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: packs[0] });
      }
    }
    return { jars, shaderpacks: packs };
  }

  function cleanupVoiceChatJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!lower.startsWith('voicechat-') && !lower.startsWith('voicechat_')) continue;
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  async function downloadModrinthResourcePack({ slug, localName, resourcepacksDir, gameVersion, label, onNotice }) {
    const candidates = expandResourcePackGameVersions(gameVersion);
    let versions = await modrinthClient.listProjectVersions(slug, { gameVersions: candidates });
    if (!versions.length) {
      versions = (await modrinthClient.listProjectVersions(slug, {}))
        .filter((v) => versionListsGame(v.game_versions, gameVersion));
    }

    const picked = pickNewestModrinthVersion(versions, { gameVersion, gameVersionCandidates: candidates });
    if (!picked) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `${label} bu Minecraft sÃ¼rÃ¼mÃ¼ (${gameVersion}) iÃ§in Modrinth'te bulunamadÄ±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, `${label} dosyasÄ± Modrinth'te bulunamadÄ±.`);
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, localName), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
    const versionLabel = picked.name || picked.version_number || label;
    if (onNotice) onNotice(`${label} ${versionLabel} hazÄ±r: ${localName}`);
    return [localName];
  }

  async function downloadGlowingOresResourcePack({ resourcepacksDir, gameVersion, onNotice, useContinuity = true }) {
    const candidates = expandResourcePackGameVersions(gameVersion);
    let versions = await modrinthClient.listProjectVersions(GLOWING_ORES_SLUG, { gameVersions: candidates });
    if (!versions.length) {
      versions = (await modrinthClient.listProjectVersions(GLOWING_ORES_SLUG, {}))
        .filter((v) => versionListsGame(v.game_versions, gameVersion));
    }

    const picked = pickGlowingOresVersion(versions, { gameVersion, wantBorder: !!useContinuity });
    if (!picked) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `New Glowing Ores bu Minecraft sÃ¼rÃ¼mÃ¼ (${gameVersion}) iÃ§in Modrinth'te bulunamadÄ±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'New Glowing Ores dosyasÄ± Modrinth\'te bulunamadÄ±.');
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, GLOWING_ORES_PACK_LOCAL_NAME), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({
      resourcepacksDir,
      localName: GLOWING_ORES_PACK_LOCAL_NAME,
      gameVersion,
    });

    const variant = glowingOresVariantLabel(picked);
    const variantLabel = variant === 'border' ? 'Border (Continuity)' : 'Default (OptiFine/Continuity)';
    if (onNotice) onNotice(`New Glowing Ores ${variantLabel} hazÄ±r: ${GLOWING_ORES_PACK_LOCAL_NAME}`);
    return [GLOWING_ORES_PACK_LOCAL_NAME];
  }

  async function downloadFullbrightResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    const expanded = expandResourcePackGameVersions(gameVersion);
    let versions = await modrinthClient.listProjectVersions(FULLBRIGHT_UB_SLUG, { gameVersions: expanded });
    if (!versions.length) {
      versions = (await modrinthClient.listProjectVersions(FULLBRIGHT_UB_SLUG, {}))
        .filter((v) => versionListsGame(v.game_versions, gameVersion));
    }

    const picked = pickNewestModrinthVersion(versions, { gameVersion });
    if (!picked) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Fullbright UB bu Minecraft sÃ¼rÃ¼mÃ¼ (${gameVersion}) iÃ§in Modrinth/CurseForge'ta bulunamadÄ±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'Fullbright UB dosyasÄ± Modrinth\'te bulunamadÄ±.');
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, FULLBRIGHT_PACK_LOCAL_NAME), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({
      resourcepacksDir,
      localName: FULLBRIGHT_PACK_LOCAL_NAME,
      gameVersion,
    });

    const label = picked.name || picked.version_number || 'Fullbright UB';
    if (onNotice) onNotice(`Fullbright UB ${label} hazÄ±r: ${FULLBRIGHT_PACK_LOCAL_NAME}`);
    return [FULLBRIGHT_PACK_LOCAL_NAME];
  }

  async function downloadBetterLeavesResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    return downloadModrinthResourcePack({
      slug: BETTER_LEAVES_SLUG,
      localName: BETTER_LEAVES_PACK_LOCAL_NAME,
      resourcepacksDir,
      gameVersion,
      label: "Motschen's Better Leaves",
      onNotice,
    });
  }

  async function downloadRoundTreesResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    return downloadModrinthResourcePack({
      slug: ROUND_TREES_SLUG,
      localName: ROUND_TREES_PACK_LOCAL_NAME,
      resourcepacksDir,
      gameVersion,
      label: 'Round Trees',
      onNotice,
    });
  }

  async function downloadCrops3dResourcePack({ resourcepacksDir, gameVersion, onNotice }) {
    return downloadModrinthResourcePack({
      slug: CROPS_3D_SLUG,
      localName: CROPS_3D_PACK_LOCAL_NAME,
      resourcepacksDir,
      gameVersion,
      label: '3D crops Revamped',
      onNotice,
    });
  }

  function glowingOresUseContinuityPack({ includeOptifine = false, includeEmbossed = false, presets = null } = {}) {
    if (presets) {
      if (presets.optifine) return false;
      return !!(presets.embossedBlocks || glowingOresNeedsContinuity(presets));
    }
    if (includeOptifine) return false;
    return !!includeEmbossed;
  }

  async function installFullbrightForExternalLoader({
    loader,
    gameRoot,
    gameVersion,
    emit,
    includeShader = false,
    includeOptifine = false,
  }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    status('Fullbright UB kaynak paketi indiriliyor...');
    const resourcepacks = await downloadFullbrightResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    if (resourcepacks[0]) {
      ensureResourcePackCompatibleForGame({ resourcepacksDir, localName: resourcepacks[0], gameVersion });
      ensureFileResourcePackInOptions(gameRoot, resourcepacks[0]);
    }

    if (includeShader && !includeOptifine && (loader === 'fabric' || loader === 'quilt') && polytoneSupportedForGameVersion(gameVersion)) {
      status('Fullbright + Shader iÃ§in PolyTone indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [POLYTONE_SLUG],
          modrinthLoaders: [loader],
        });
      } catch {
        status('PolyTone bulunamadÄ± â€” Fullbright Sodium/Iris ile Ã§alÄ±ÅŸmayabilir.');
      }
    }
    return { resourcepacks };
  }

  async function installRoundTreesForExternalLoader({ gameRoot, gameVersion, emit }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const status = statusEmitter(emit);
    status('Round Trees kaynak paketi indiriliyor...');
    const resourcepacks = await downloadRoundTreesResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    return { resourcepacks };
  }

  async function installCrops3dForExternalLoader({ gameRoot, gameVersion, emit }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const status = statusEmitter(emit);
    status('3D crops Revamped kaynak paketi indiriliyor...');
    const resourcepacks = await downloadCrops3dResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    return { resourcepacks };
  }

  async function installBetterLeavesForExternalLoader({
    loader,
    gameRoot,
    gameVersion,
    emit,
    includeShader = false,
    includeEmbossed = false,
    includeOptifine = false,
  }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    status("Motschen's Better Leaves kaynak paketi indiriliyor...");
    const resourcepacks = await downloadBetterLeavesResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
    });
    if (resourcepacks[0]) {
      ensureResourcePackCompatibleForGame({ resourcepacksDir, localName: resourcepacks[0], gameVersion });
      ensureFileResourcePackInOptions(gameRoot, resourcepacks[0]);
    }

    const modLoader = loader === 'forge-optifine' ? 'forge' : loader;
    if (!includeOptifine && ['fabric', 'quilt', 'forge', 'neoforge'].includes(modLoader)) {
      status('Better Leaves iÃ§in Cull Leaves indiriliyor (Sodium/Embeddium baÄŸÄ±mlÄ±lÄ±klarÄ± otomatik)...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CULL_LEAVES_SLUG],
          modrinthLoaders: [modLoader],
        });
      } catch {
        status('Cull Leaves bulunamadÄ± â€” OptiFine Smart Leaves veya Fabric yÃ¼kleyici deneyin.');
      }
    } else if (loader === 'vanilla') {
      status(
        "Better Leaves: Vanilla'da tam etki iÃ§in Fabric + Cull Leaves veya Forge/OptiFine + Smart Leaves kullanÄ±n."
      );
    }
    return { resourcepacks };
  }

  async function installGlowingOresForExternalLoader({
    loader,
    gameRoot,
    gameVersion,
    emit,
    includeOptifine = false,
    includeEmbossed = false,
  }) {
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    const modLoader = loader === 'forge-optifine' ? 'forge' : loader;
    const willInstallContinuity =
      !includeOptifine && !includeEmbossed && ['fabric', 'quilt', 'forge'].includes(modLoader);
    const useContinuityPack = includeEmbossed || willInstallContinuity;

    status('New Glowing Ores kaynak paketi indiriliyor...');
    const resourcepacks = await downloadGlowingOresResourcePack({
      resourcepacksDir,
      gameVersion,
      onNotice: status,
      useContinuity: useContinuityPack,
    });
    if (resourcepacks[0]) {
      ensureResourcePackCompatibleForGame({ resourcepacksDir, localName: resourcepacks[0], gameVersion });
      ensureFileResourcePackInOptions(gameRoot, resourcepacks[0]);
    }

    if (!includeOptifine && !includeEmbossed && modLoader === 'neoforge') {
      status('Glowing Ores: NeoForge\'da Continuity + Connector gerekir â€” maden parÄ±ltÄ±sÄ± gÃ¶rÃ¼nmeyebilir.');
    } else if (willInstallContinuity) {
      status('Glowing Ores iÃ§in Continuity indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CONTINUITY_SLUG],
          modrinthLoaders: [modLoader],
        });
        ensureContinuityResourcePacks(gameRoot);
      } catch {
        status('Continuity bulunamadÄ± â€” OptiFine Emissive Textures veya KabartmalÄ± bloklar (Continuity) gerekir.');
      }
    } else if (includeOptifine) {
      status('Glowing Ores (Default): OptiFine\'da Video AyarlarÄ± â†’ Kalite â†’ Emissive Textures aÃ§Ä±n.');
    } else if (loader === 'vanilla') {
      status('Glowing Ores (Default): Vanilla\'da parÄ±ltÄ± iÃ§in Fabric+Continuity veya Forge+OptiFine kullanÄ±n.');
    }
    return { resourcepacks };
  }

  async function installVoiceChatForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    cleanupVoiceChatJars(modsDir);
    status(`Simple Voice Chat indiriliyor (${loader})...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs: [VOICE_CHAT_SLUG],
      modrinthLoaders: [loader],
    });
    return { jars };
  }

  function readManagedCreateJars(modsDir) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(modsDir, CREATE_MARKER_FILE), 'utf8'));
      return Array.isArray(raw && raw.jars)
        ? raw.jars.map((j) => path.basename(String(j || ''))).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  // Launcher'Ä±n kurduÄŸu Create jar'larÄ±nÄ± (loader geÃ§iÅŸinde stash'lenmiÅŸ kopyalarÄ±
  // dahil) siler. `keep` listesindeki adlarÄ±n etkin kopyasÄ± korunur.
  function removeManagedCreateJars(gameRoot, { keep = [] } = {}) {
    const modsDir = path.join(gameRoot, 'mods');
    const managed = readManagedCreateJars(modsDir);
    if (managed.length === 0) return;
    for (const jar of managed) {
      if (!keep.includes(jar)) removeIfExists(path.join(modsDir, jar));
      for (const suffix of STASH_SUFFIXES) removeIfExists(path.join(modsDir, jar + suffix));
    }
    if (keep.length === 0) removeIfExists(path.join(modsDir, CREATE_MARKER_FILE));
  }

  function readCreateMarker(modsDir) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(modsDir, CREATE_MARKER_FILE), 'utf8'));
      return { tuned: raw.tuned === 2, flywheelTuned: raw.flywheelTuned === 2 };
    } catch {
      return { tuned: false, flywheelTuned: false };
    }
  }

  // Flywheel: compute-shader tabanlÄ± "indirect" backend ve SMOOTH Ä±ÅŸÄ±k, entegre GPU'da
  // pahalÄ±. Dosya ilk oyun aÃ§Ä±lÄ±ÅŸÄ±nda oluÅŸur; yoksa sonraki aÃ§Ä±lÄ±ÅŸta denenir.
  function tuneFlywheelConfig(gameRoot) {
    const cfgPath = path.join(gameRoot, FLYWHEEL_CONFIG_REL);
    let text;
    try {
      text = fs.readFileSync(cfgPath, 'utf8');
    } catch {
      return null;
    }
    const next = text
      .replace(/^(\s*backend\s*=\s*)"(?:DEFAULT|INSTANCING)"/m, '$1"flywheel:instancing"')
      .replace(/^(\s*lightSmoothness\s*=\s*)"SMOOTH"/m, '$1"FLAT"');
    if (next !== text) fs.writeFileSync(cfgPath, next, 'utf8');
    return next !== text;
  }

  // Her aÃ§Ä±lÄ±ÅŸta: render/simÃ¼lasyon mesafesi Ã¼st sÄ±nÄ±rÄ± aÅŸÄ±yorsa dÃ¼ÅŸÃ¼rÃ¼r (altÄ±ndakilere dokunmaz).
  function capCreateDistances(gameRoot) {
    const optionsPath = path.join(gameRoot, 'options.txt');
    let text;
    try {
      text = fs.readFileSync(optionsPath, 'utf8');
    } catch {
      return false;
    }
    let changed = false;
    const lines = text.split(NEWLINE_RE).map((line) => {
      const key = line.startsWith('simulationDistance:')
        ? 'simulationDistance'
        : line.startsWith('renderDistance:')
          ? 'renderDistance'
          : null;
      if (!key) return line;
      const max = key === 'simulationDistance' ? CREATE_SIMULATION_DISTANCE_MAX : CREATE_RENDER_DISTANCE_MAX;
      const cur = Number(line.slice(key.length + 1));
      if (!Number.isFinite(cur) || cur <= max) return line;
      changed = true;
      return key + ':' + max;
    });
    if (changed) fs.writeFileSync(optionsPath, lines.join('\n'), 'utf8');
    return changed;
  }

  // options.txt'te Ã¼st sÄ±nÄ±rÄ± aÅŸan deÄŸerleri dÃ¼ÅŸÃ¼rÃ¼r; sÄ±nÄ±rÄ±n altÄ±ndakilere dokunmaz.
  function capCreateVideoOptions(gameRoot) {
    const optionsPath = path.join(gameRoot, 'options.txt');
    let text;
    try {
      text = fs.readFileSync(optionsPath, 'utf8');
    } catch {
      return false;
    }
    let changed = false;
    const lines = text.split(NEWLINE_RE).map((line) => {
      const i = line.indexOf(':');
      if (i < 0) return line;
      const cap = CREATE_VIDEO_CAPS[line.slice(0, i)];
      const cur = Number(line.slice(i + 1));
      if (cap === undefined || !Number.isFinite(cur) || cur <= cap) return line;
      changed = true;
      return line.slice(0, i + 1) + cap;
    });
    for (let n = 0; n < lines.length; n += 1) {
      const i = lines[n].indexOf(':');
      if (i < 0) continue;
      const want = CREATE_VIDEO_FORCE[lines[n].slice(0, i)];
      if (want !== undefined && lines[n].slice(i + 1) !== want) {
        lines[n] = lines[n].slice(0, i + 1) + want;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(optionsPath, lines.join('\n'), 'utf8');
    return changed;
  }

  // HazÄ±r paketlerin video ayarÄ±: render mesafesi 12'ye ayarlanÄ±r, aÄŸÄ±r ayarlar sÄ±nÄ±rlanÄ±r.
  // Paket baÅŸÄ±na bir kez uygulanÄ±r; paket kapatÄ±lÄ±nca iÅŸaret silinir, yeniden seÃ§ilince tekrar uygulanÄ±r.
  function syncFpsBoostVideoOptions({ gameRoot, modsDir, enabled, unlimited, status }) {
    const markerPath = path.join(modsDir, FPS_BOOST_MARKER_FILE);
    const optionsPath = path.join(gameRoot, 'options.txt');
    let marker = null;
    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    } catch {
      /* iÅŸaret yok ya da bozuk */
    }
    let text = '';
    try {
      text = fs.readFileSync(optionsPath, 'utf8');
    } catch {
      /* ilk kurulum: options.txt henÃ¼z yok */
    }
    if (!enabled) {
      if (!marker) return;
      // YalnÄ±zca paketin yazdÄ±ÄŸÄ± deÄŸer hÃ¢lÃ¢ duruyorsa geri al; kullanÄ±cÄ± oyun iÃ§inden deÄŸiÅŸtirdiyse dokunma.
      const prev = (marker && marker.prev) || {};
      const written = FPS_BOOST_FORCED_OPTIONS[marker.mode] || FPS_BOOST_FORCED_OPTIONS.unlimited;
      const restored = text.split(NEWLINE_RE).map((line) => {
        const i = line.indexOf(':');
        const key = i < 0 ? '' : line.slice(0, i);
        const back = prev[key] !== undefined ? prev[key] : FPS_BOOST_RESTORE_DEFAULTS[key];
        if (back === undefined || line.slice(i + 1) !== String(written[key])) return line;
        return key + ':' + back;
      }).join('\n');
      if (restored !== text) fs.writeFileSync(optionsPath, restored, 'utf8');
      removeIfExists(markerPath);
      return;
    }
    const mode = unlimited ? 'unlimited' : 'capped';
    if (marker && marker.tuned === FPS_BOOST_TUNE_VERSION && marker.mode === mode) return;

    // "Ã–nceki deÄŸer" yalnÄ±zca paket ilk uygulandÄ±ÄŸÄ±nda dosyadan okunur; paketler arasÄ± geÃ§iÅŸte
    // dosyadaki deÄŸer Ã¶teki paketin yazdÄ±ÄŸÄ±dÄ±r, eski iÅŸaretteki korunur.
    const forced = FPS_BOOST_FORCED_OPTIONS[mode];
    const prev = { ...((marker && marker.prev) || {}) };
    const seen = new Set();
    const lines = text.split(NEWLINE_RE).map((line) => {
      const i = line.indexOf(':');
      if (i < 0) return line;
      const key = line.slice(0, i);
      if (forced[key] !== undefined) {
        seen.add(key);
        if (!marker && key !== 'renderDistance') prev[key] = line.slice(i + 1);
        return key + ':' + forced[key];
      }
      if (CREATE_VIDEO_FORCE[key] !== undefined) return key + ':' + CREATE_VIDEO_FORCE[key];
      const cap = CREATE_VIDEO_CAPS[key];
      const cur = Number(line.slice(i + 1));
      if (cap === undefined || !Number.isFinite(cur) || cur <= cap) return line;
      return key + ':' + cap;
    });
    let next = lines.join('\n');
    const missing = Object.keys(forced).filter((key) => !seen.has(key));
    if (missing.length > 0) {
      next = next.replace(/\n+$/, '');
      next = (next ? next + '\n' : '') + missing.map((key) => key + ':' + forced[key]).join('\n') + '\n';
    }
    if (next !== text) fs.writeFileSync(optionsPath, next, 'utf8');
    fs.mkdirSync(modsDir, { recursive: true });
    fs.writeFileSync(markerPath, JSON.stringify({ tuned: FPS_BOOST_TUNE_VERSION, mode, prev }), 'utf8');
    status('Paket: render mesafesi ' + FPS_BOOST_RENDER_DISTANCE + ' chunk yapÄ±ldÄ±, ' + (unlimited ? 'FPS sÄ±nÄ±rÄ± kaldÄ±rÄ±ldÄ±' : 'FPS sÄ±nÄ±rÄ± 120 yapÄ±ldÄ±') + ', aÄŸÄ±r video ayarlarÄ± dÃ¼ÅŸÃ¼rÃ¼ldÃ¼ (oyun iÃ§inden deÄŸiÅŸtirilebilir).');
  }

  function releaseFpsBoostVideoOptions(gameRoot) {
    syncFpsBoostVideoOptions({ gameRoot, modsDir: path.join(gameRoot, 'mods'), enabled: false });
  }

  // Create + kÃ¼ratÃ¶rlÃ¼ eklenti listesi (CREATE_ADDON_SLUGS). ArayÃ¼z bu seÃ§eneÄŸi NeoForge
  // 1.21.1'e sabitler. GÃ¼ncel jar'lar yeniden indirilmez; Modrinth'e ulaÅŸÄ±lamazsa kurulu
  // jar'larla devam edilir (tek oyunculu, Ã§evrimdÄ±ÅŸÄ± aÃ§Ä±lÄ±ÅŸ). Taban Create bulunamazsa
  // hata verilir; bir eklentinin uygun sÃ¼rÃ¼mÃ¼ yoksa o eklenti sessizce atlanÄ±r.
  //
  // `serverPack`: Klima SMP paketi â€” Create ve eklentileri sunucuyla aynÄ±
  // sabit sÃ¼rÃ¼mden kurulur (NeoForge kayÄ±t eÅŸleÅŸmesi), yalnÄ±zca FPS modlarÄ± gÃ¼ncel Ã§ekilir.
  async function installCreateForExternalLoader({ loader, gameRoot, gameVersion, emit, serverPack = false }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    const previous = readManagedCreateJars(modsDir);
    // Sunucu paketinde Ã§evrimdÄ±ÅŸÄ± yedek yalnÄ±zca sabit jar'lar zaten kuruluysa kullanÄ±lÄ±r:
    // normal Create paketinin eklentileriyle sunucuya baÄŸlanÄ±lamaz.
    const previousOnDisk =
      previous.length > 0 &&
      previous.every((j) => fs.existsSync(path.join(modsDir, j))) &&
      (!serverPack || MARSANA_SERVER_PINNED_MODS.every((m) => previous.includes(m.file)));

    status(serverPack ? 'Klima SMP paketi hazÄ±rlanÄ±yor...' : 'Create ve eklentileri hazÄ±rlanÄ±yor...');
    let jars;
    try {
      if (serverPack) {
        const pinned = await downloadPinnedMods(modsDir, MARSANA_SERVER_PINNED_MODS);
        const perf = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [...CREATE_PERF_SLUGS],
          modrinthLoaders: [loader],
          skipExisting: true,
          optionalSlugs: new Set(CREATE_PERF_SLUGS),
        });
        jars = [...pinned, ...perf.filter((j) => !pinned.includes(j))];
      } else {
        jars = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CREATE_SLUG, ...CREATE_ADDON_SLUGS, ...CREATE_PERF_SLUGS],
          modrinthLoaders: [loader],
          skipExisting: true,
          optionalSlugs: new Set([...CREATE_ADDON_SLUGS, ...CREATE_PERF_SLUGS]),
        });
        // Launcher'la gelen eklentiler; taban Create kurulduysa eklenir, jar eksikse atlanÄ±r.
        if (jars.length > 0) {
          for (const addon of CREATE_BUNDLED_ADDONS) {
            try {
              const [jar] = await downloadPinnedMods(modsDir, [addon]);
              if (!jars.includes(jar)) jars.push(jar);
            } catch (err) {
              status('Create: ' + addon.file + ' atlandÄ± (' + err.message + ').');
            }
          }
        }
      }
    } catch (err) {
      if (previousOnDisk) {
        status("Create: Modrinth'e ulaÅŸÄ±lamadÄ± â€” kurulu sÃ¼rÃ¼mlerle devam ediliyor.");
        return { jars: previous };
      }
      throw err;
    }

    if (jars.length === 0) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Create modunun ${loader} ${gameVersion} uyumlu sÃ¼rÃ¼mÃ¼ Modrinth'te bulunamadÄ±.`
      );
    }
    if (capCreateDistances(gameRoot)) {
      status('Create: render mesafesi en fazla ' + CREATE_RENDER_DISTANCE_MAX + ', simÃ¼lasyon mesafesi en fazla ' + CREATE_SIMULATION_DISTANCE_MAX + ' (takÄ±lmayÄ± Ã¶nler).');
    }
    const marker = readCreateMarker(modsDir);
    let tuned = marker.tuned;
    let flywheelTuned = marker.flywheelTuned;
    if (!flywheelTuned) {
      const r = tuneFlywheelConfig(gameRoot);
      if (r !== null) {
        flywheelTuned = true;
        if (r) status('Create: Flywheel hafif moda alÄ±ndÄ± (entegre ekran kartÄ± iÃ§in).');
      }
    }
    if (!tuned) {
      if (capCreateVideoOptions(gameRoot)) {
        status('Create: render mesafesi ve benzeri aÄŸÄ±r video ayarlarÄ± FPS iÃ§in dÃ¼ÅŸÃ¼rÃ¼ldÃ¼ (oyun iÃ§inden deÄŸiÅŸtirilebilir).');
      }
      tuned = true;
    }
    // Listeden Ã§Ä±kan / gÃ¼ncellenen eski jar'larÄ± sil, marker'Ä± tÃ¼m yeni jar'larla yaz.
    removeManagedCreateJars(gameRoot, { keep: jars });
    fs.writeFileSync(
      path.join(modsDir, CREATE_MARKER_FILE),
      JSON.stringify({ jars, tuned: tuned ? 2 : 0, flywheelTuned: flywheelTuned ? 2 : 0 }, null, 2),
      'utf8'
    );
    return { jars };
  }

  function sha512OfFile(filePath) {
    try {
      return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('hex');
    } catch {
      return '';
    }
  }

  // Sabit sÃ¼rÃ¼mlÃ¼ jar'larÄ± indirir; diskte aynÄ± hash'le duranlar yeniden indirilmez.
  async function downloadPinnedMods(modsDir, mods) {
    await fs.promises.mkdir(modsDir, { recursive: true });
    const jars = [];
    for (const mod of mods) {
      const safeName = path.basename(String(mod.file || ''));
      const destPath = assertInside(modsDir, safeName);
      if (sha512OfFile(destPath) !== mod.sha512) {
        if (mod.bundled) {
          // Modrinth'te olmayan (Ã¶r. incelemede) mod: launcher'la gelen jar kopyalanÄ±r.
          const src = repoRoot ? path.join(repoRoot, 'bundled-mods', mod.bundled) : null;
          if (!src || sha512OfFile(src) !== mod.sha512) {
            throw new LauncherError(
              Codes.MODRINTH_NOT_FOUND,
              `Klima SMP modu launcher iÃ§inde bulunamadÄ±: ${safeName}`
            );
          }
          await fs.promises.copyFile(src, destPath);
        } else {
          await httpClient.download(mod.url, destPath, { sha512: mod.sha512 });
        }
      }
      jars.push(safeName);
    }
    return jars;
  }

  // Forge ailesi loader'lar iÃ§in kabartmalÄ± blok (CTM) modunu yÃ¼kle.
  //   'forge'           â†’ Continuity Forge (sadece 1.20.1; Modrinth'te tek sÃ¼rÃ¼m)
  //   'neoforge'        â†’ Continuity NeoForge (sadece 1.21.1; tek sÃ¼rÃ¼m)
  //   'forge-optifine'  â†’ no-op (OptiFine kendi iÃ§inde CTM destekler)
  async function installEmbossedForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);

    if (loader === 'forge-optifine') {
      status('Kabartma: OptiFine kendi iÃ§inde baÄŸlÄ± doku desteÄŸi saÄŸlÄ±yor â€” ek mod indirilmedi.');
      return { jars: [] };
    }
    if (loader === 'neoforge') {
      // NeoForge'da Continuity native deÄŸil â€” sadece Sinytra Connector ile
      // Ã§alÄ±ÅŸan Fabric jar'Ä± ve bu kombinasyon NeoForge 21.1.x ile
      // ClassCastException (ModFileParser$MixinConfig) atÄ±yor. Indirmeyi
      // atla, kullanÄ±cÄ±yÄ± bilgilendir.
      status('Kabartma: NeoForge bu sÃ¼rÃ¼mde Continuity\'yi native desteklemiyor â€” atlandÄ±.');
      return { jars: [] };
    }
    if (loader !== 'forge') {
      throw new Error(`installEmbossedForExternalLoader: desteklenmeyen loader: ${loader}`);
    }

    cleanupForgeFamilyEmbossedJars(modsDir);

    status(`Kabartma (Continuity ${loader}) indiriliyor...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs: ['continuity'],
      modrinthLoaders: [loader],
    });

    // options.txt'e Continuity resource pack'lerini ekle â€” Continuity 3.0+ kendi
    // built-in resource pack'lerini sunar ama Minecraft options'ta listelenmek
    // zorundadÄ±r, aksi takdirde CTM gÃ¶rÃ¼nmez.
    ensureContinuityResourcePacks(gameRoot);

    return { jars };
  }

  async function ensure({ gameRoot, gameVersion, emit, modPresets, shaderSlug, fabricChannel = 'stable', playMode }) {
    const presets = normalizePresets(modPresets);
    if (!presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm && !presets.clientHudPack && !presets.marsanaClientMenu && !presets.sodium && !presets.sodiumExtra && !presets.userMods) {
      throw new Error('shaderStackService.ensure: en az bir mod Ã¶nayarÄ± gerekli');
    }

    const loaderPrefix = fabricChannel === 'beta' ? 'marsana-fabric-beta' : 'marsana';
    const wantsShader = presets.shaderFps && !presets.optifine;
    const resolvedShaderSlug = wantsShader ? resolveShaderSlug(shaderSlug) : DEFAULT_SHADER_SLUG;
    const status = statusEmitter(emit);
    const customId = customIdFor(gameVersion, presets, resolvedShaderSlug, { loaderPrefix });
    const versionDir = path.join(gameRoot, 'versions', customId);
    const modsDir = path.join(gameRoot, 'mods');
    modIsolationService.enforceModIsolation(modsDir, presets, playMode);
    if (!presets.schematicFarm) {
      schematicFarmModService.removeSchematicFarmJars(modsDir);
    }
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const resourcepacksDir = path.join(gameRoot, 'resourcepacks');
    const versionJsonPath = path.join(versionDir, `${customId}.json`);
    const readyPath = path.join(versionDir, READY_FILE);

    hudDepsService.recoverFabricModsFromMisstash(modsDir, gameVersion);
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);

    if (wantsShader) {
      repairLegacyShaderPack({
        gameRoot,
        shaderpacksDir,
        shaderSlug: resolvedShaderSlug,
        activateFns: [activateShaderPackInIrisConfig],
      });
    } else {
      deactivateShaderConfig(gameRoot);
    }
    syncFpsBoostVideoOptions({ gameRoot, modsDir, enabled: presets.fpsBoost, unlimited: presets.fpsUnlimited, status });

    const cached = cachedReady({
      versionDir,
      modsDir,
      shaderpacksDir,
      resourcepacksDir,
      gameVersion,
      versionJsonPath,
      readyPath,
      modPresets: presets,
      shaderSlug: resolvedShaderSlug,
    });
    if (cached) {
      modIsolationService.enforceModIsolation(modsDir, presets, playMode);
      if (presets.shaderFps && !presets.optifine && cached.shaderpacks[0]) {
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: cached.shaderpacks[0] });
      }
      applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir });
      let bundle = readBundle(modsDir);
      let cacheJars = bundle && bundle.jars;
      cacheJars = await ensureShaderCoreMods({
        modsDir,
        gameVersion,
        presets,
        status,
        jars: cacheJars,
      });
      cacheJars = refreshManagedJarEntries(cacheJars, modsDir, gameVersion);
      if (
        presets.clientHudPack ||
        hudDepsService.fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack: !!presets.clientHudPack })
      ) {
        cacheJars = await ensureHudRuntimeDepsAsync({
          modsDir,
          gameVersion,
          status,
          jars: cacheJars,
          presets,
        });
      }
      if (bundle && cacheJars) {
        writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
      }
      if (presets.optifine) {
        cacheJars = await finalizeOptifineModState({
          modsDir,
          gameVersion,
          status,
          jars: cacheJars,
          presets,
        });
        bundle = readBundle(modsDir);
        if (bundle && cacheJars) {
          writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
        }
      }
      if (presets.marsanaClientMenu && repoRoot) {
        const menuJar = marsanaClientModService.installBundledMod({
          repoRoot,
          modsDir,
          gameVersion,
          onNotice: status,
        });
        if (menuJar) {
          bundle = readBundle(modsDir);
          if (bundle) {
            cacheJars = [...new Set([...(cacheJars || []), menuJar])];
            writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
          }
        }
        marsanaClientModService.seedHudFeatureDefaults(gameRoot);
        const cfg = marsanaClientModService.readConfig(gameRoot);
        marsanaClientModService.applyModToggleStates(modsDir, cfg);
      } else if (presets.marsanaClientMenu) {
        const cfg = marsanaClientModService.readConfig(gameRoot);
        marsanaClientModService.applyModToggleStates(modsDir, cfg);
      }
      if (presets.schematicFarm && repoRoot) {
        const schematicJar = schematicFarmModService.installBundledMod({
          repoRoot,
          modsDir,
          gameVersion,
          onNotice: status,
        });
        if (schematicJar) {
          bundle = readBundle(modsDir);
          if (bundle) {
            cacheJars = [...new Set([...(cacheJars || []), schematicJar])];
            writeBundle(modsDir, { ...bundle, jars: cacheJars, updatedAt: Date.now() });
          }
        }
      }
      status(`Mod profili (Ã¶nbellek): ${resolvedShaderSlug} shader hazÄ±r, baÅŸlatÄ±lÄ±yor...`);
      await installFabricProfile({
        gameVersion,
        customId,
        versionDir,
        versionJsonPath,
        fabricChannel,
      });
      modIsolationService.enforceModIsolation(modsDir, presets, playMode);
      return { customId: cached.customId, assetIndexId: cached.assetIndexId };
    }

    status(`Mod profili: Fabric yÃ¼kleyici eÅŸleÅŸtiriliyor (${gameVersion})...`);
    const { merged, loaderVersion } = await installFabricProfile({
      gameVersion,
      customId,
      versionDir,
      versionJsonPath,
      fabricChannel,
    });
    await ensureAssetIndexFile({ gameRoot, assetIndex: merged.assetIndex });

    status('Mod profili: seÃ§ilen modlar indiriliyor...');
    cleanupPreviousBundle({ modsDir, shaderpacksDir, resourcepacksDir });
    removeIncompatiblePolytoneJars(modsDir, gameVersion);

    let optifineMeta = null;
    if (presets.optifine) {
      optifineMeta = await mrpackInstaller.installFromProject({
        projectSlug: OPTIFINE_PROJECT,
        gameVersion,
        gameRoot,
        emit,
      });
    }

    const slugs = modrinthSlugsForPresets(presets, gameVersion);
    if (presets.clientHudPack) {
      status('Client HUD paketi: minimap ve client modlari indiriliyor (uyumlu olanlar)...');
    }
    let jars = slugs.length ? await downloadModsFromSlugs({ modsDir, gameVersion, slugs }) : [];
    if (
      presets.clientHudPack ||
      hudDepsService.fabricHudRuntimeDepsNeeded(modsDir, { clientHudPack: !!presets.clientHudPack })
    ) {
      jars = await ensureHudRuntimeDepsAsync({ modsDir, gameVersion, status, jars, presets });
    }
    let fpsBoostJars = [];
    if (presets.fpsBoost) {
      status('Paket: FPS optimizasyon modlarÄ± indiriliyor (uyumlu olanlar)...');
      try {
        fpsBoostJars = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: FPS_BOOST_SLUGS,
          optionalSlugs: new Set(FPS_BOOST_SLUGS),
        });
      } catch {
        status('Paket: bazÄ± FPS modlarÄ± indirilemedi â€” kalan modlarla devam ediliyor.');
      }
    }
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    jars = await ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars });
    // Uyumsuz Ã§Ä±kÄ±p temizlenen FPS modu bundle'a yazÄ±lmamalÄ±; yoksa Ã¶nbellek her aÃ§Ä±lÄ±ÅŸta geÃ§ersiz olur.
    for (const name of fpsBoostJars) {
      if (!jars.includes(name) && fs.existsSync(path.join(modsDir, name))) jars.push(name);
    }
    if (optifineMeta && Array.isArray(optifineMeta.jarNames)) {
      const seen = new Set(jars);
      for (const name of optifineMeta.jarNames) {
        if (!seen.has(name)) {
          seen.add(name);
          jars.push(name);
        }
      }
    }
    if (presets.optifine && presets.embossedBlocks) {
      const enabled = enableOptifineEmbossedMods(modsDir);
      const seen = new Set(jars);
      for (const name of enabled) {
        if (!seen.has(name)) {
          seen.add(name);
          jars.push(name);
        }
      }
    }
    if (optifineMeta || presets.optifine) {
      status('OptiFine paketi sonrasi mod surumleri esitleniyor...');
      jars = await ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars });
      jars = await finalizeOptifineModState({
        modsDir,
        gameVersion,
        status,
        jars,
        presets,
      });
    }

    if (presets.marsanaClientMenu && repoRoot) {
      const menuJar = marsanaClientModService.installBundledMod({
        repoRoot,
        modsDir,
        gameVersion,
        onNotice: status,
      });
      if (menuJar && !jars.includes(menuJar)) {
        jars.push(menuJar);
      }
      marsanaClientModService.seedHudFeatureDefaults(gameRoot);
      const cfg = marsanaClientModService.readConfig(gameRoot);
      marsanaClientModService.applyModToggleStates(modsDir, cfg);
    }

    if (presets.schematicFarm && repoRoot) {
      status('Sematik Farm modu kuruluyor...');
      const schematicJar = schematicFarmModService.installBundledMod({
        repoRoot,
        modsDir,
        gameVersion,
        onNotice: status,
      });
      if (schematicJar && !jars.includes(schematicJar)) {
        jars.push(schematicJar);
      }
    }

    let resourcepacks = [];
    if (presets.fullbrightUb) {
      status('Mod profili: Fullbright UB kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadFullbrightResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }
    if (presets.betterLeaves) {
      status("Mod profili: Motschen's Better Leaves kaynak paketi indiriliyor...");
      resourcepacks.push(...(await downloadBetterLeavesResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }
    if (presets.glowingOres) {
      status('Mod profili: New Glowing Ores kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadGlowingOresResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
        useContinuity: glowingOresUseContinuityPack({ presets }),
      })));
    }
    if (presets.crops3d) {
      status('Mod profili: 3D crops Revamped kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadCrops3dResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }
    if (presets.roundTrees) {
      status('Mod profili: Round Trees kaynak paketi indiriliyor...');
      resourcepacks.push(...(await downloadRoundTreesResourcePack({
        resourcepacksDir,
        gameVersion,
        onNotice: status,
      })));
    }

    applyModResourcePackPresets({ gameRoot, gameVersion, presets, resourcepacksDir });

    let shaderpacks = [];
    if (presets.shaderFps && !presets.optifine) {
      status(`Mod profili: shader paketi indiriliyor (${resolvedShaderSlug})...`);
      shaderpacks = await downloadShaderPack({
        shaderpacksDir,
        gameVersion,
        shaderSlug: resolvedShaderSlug,
        onNotice: status,
      });
      if (shaderpacks[0]) {
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: shaderpacks[0] });
      }
    }

    const assetIndexId = merged.assetIndex?.id || gameVersion;

    fs.writeFileSync(
      readyPath,
      JSON.stringify(
        { gameVersion, customId, assetIndexId, loader: loaderVersion, readyAt: Date.now(), presets, shaderSlug: resolvedShaderSlug },
        null,
        2
      ),
      'utf8'
    );
    writeBundle(modsDir, {
      bundleVersion: SHADER_BUNDLE_VERSION,
      gameVersion,
      loader: loaderVersion,
      jars,
      shaderpacks,
      resourcepacks,
      assetIndexId,
      presets,
      optifineMeta,
      shaderSlug: resolvedShaderSlug,
      updatedAt: Date.now(),
    });

    if (presets.optifine) {
      const packLabel = optifineMeta && optifineMeta.packName ? optifineMeta.packName : 'OptiFine for Fabric';
      const mc26Note = /^26\./.test(String(gameVersion))
        ? ' Resmi OptiFine.jar 26.x\'te henÃ¼z yok; zoom iÃ§in Zoomify (C) eklendi.'
        : '';
      status(
        `${packLabel} kuruldu.${mc26Note} Video ayarlarÄ± ve shader seÃ§enekleri paket iÃ§indeki modlarla gelir; ` +
          'Shader + FPS seÃ§eneÄŸiyle birlikte kullanmayÄ±n.'
      );
    } else if (presets.shaderFps && presets.embossedBlocks) {
      status(
        'Mod profili hazÄ±r. Shader: SeÃ§enekler â†’ Video â†’ Shader Packs (Complementaryâ€™de Performance Ã¶nerilir). ' +
          'Kabartma: Continuity + Sodium.'
      );
    } else if (presets.shaderFps) {
      status(
        'Shader + FPS profili hazÄ±r. Oyun iÃ§inde: SeÃ§enekler â†’ Video â†’ Shader Packs; Complementaryâ€™de Performance profili Ã¶nerilir.'
      );
    } else if (presets.voiceChat) {
      status(
        'Simple Voice Chat kuruldu. Oyunda V tuÅŸuna basarak veya ayarlardan mikrofonu yapÄ±landÄ±rÄ±n; sunucuda da mod gerekir.'
      );
    } else if (presets.fullbrightUb) {
      status(
        fullbrightNeedsPolytone(presets, gameVersion)
          ? 'Fullbright UB kuruldu. Kaynak paketi etkinleÅŸtirildi; Sodium/Iris ile PolyTone da yÃ¼klendi.'
          : presets.shaderFps && !presets.optifine && !polytoneSupportedForGameVersion(gameVersion)
            ? 'Fullbright UB kuruldu. 26.x sÃ¼rÃ¼mÃ¼nde PolyTone henÃ¼z yok â€” kaynak paketi etkin; tam parlaklÄ±k Sodium/Iris ile sÄ±nÄ±rlÄ± olabilir.'
            : 'Fullbright UB kuruldu. Kaynak paketi indirildi ve SeÃ§enekler â†’ Kaynak paketleri bÃ¶lÃ¼mÃ¼nde etkinleÅŸtirildi.'
      );
    } else if (presets.betterLeaves) {
      status(
        betterLeavesNeedsCullLeaves(presets)
          ? presets.optifine
            ? "Motschen's Better Leaves kuruldu. OptiFine â†’ Video AyarlarÄ± â†’ Kalite â†’ Smart Leaves aÃ§Ä±n."
            : "Motschen's Better Leaves kuruldu. Kaynak paketi ve Cull Leaves yÃ¼klendi."
          : "Motschen's Better Leaves kuruldu. Kaynak paketi etkinleÅŸtirildi."
      );
    } else if (presets.glowingOres) {
      const borderPack = glowingOresUseContinuityPack({ presets });
      status(
        borderPack
          ? 'New Glowing Ores (Border) kuruldu. Continuity ile parÄ±ltÄ± ve baÄŸlÄ± Ã§erÃ§eve etkin.'
          : 'New Glowing Ores (Default) kuruldu. OptiFine kullanÄ±yorsanÄ±z Emissive Textures aÃ§Ä±n.'
      );
    } else if (presets.roundTrees) {
      status('Round Trees kuruldu. Kaynak paketi listenin en Ã¼stÃ¼ne yerleÅŸtirildi.');
    } else if (presets.crops3d) {
      status('3D crops Revamped kuruldu. TarÄ±m bloklarÄ± 3D gÃ¶rÃ¼nÃ¼me geÃ§ti.');
    } else if (presets.schematicFarm) {
      status('Sematik Farm modu kuruldu. Oyunda F8 ile farm seÃ§in, Konumu Ayarla ile baÅŸlangÄ±Ã§ noktasÄ±nÄ± belirleyin.');
    } else {
      status('KabartmalÄ± blok / baÄŸlÄ± doku: Continuity + Sodium hazÄ±r.');
    }

    modIsolationService.enforceModIsolation(modsDir, presets, playMode);
    return { customId, assetIndexId };
  }

  return { ensure, applyModResourcePackPresets, installShadersForExternalLoader, installEmbossedForExternalLoader, installVoiceChatForExternalLoader, installCreateForExternalLoader, removeManagedCreateJars, releaseFpsBoostVideoOptions, installFullbrightForExternalLoader, installBetterLeavesForExternalLoader, installGlowingOresForExternalLoader, installRoundTreesForExternalLoader, installCrops3dForExternalLoader };
}

module.exports = {
  createShaderStackService,
  CREATE_BUNDLED_ADDONS,
  // O1/O4 â€” kritik Modrinth sÃ¼rÃ¼m-eÅŸleÅŸtirme mantÄ±ÄŸÄ± test edilebilsin diye dÄ±ÅŸa
  // aktarÄ±lÄ±r (davranÄ±ÅŸ DEÄÄ°ÅMEZ; ayrÄ±ca ileride ayrÄ± modÃ¼le gÃ¼venli Ã§Ä±karÄ±m
  // iÃ§in test gÃ¼venlik aÄŸÄ±). Bu fonksiyonlar saf (yan etkisiz).
  resolveShaderSlug,
  extractMcVersionFromModMeta,
  modrinthLoaderModGameVersionCandidates,
  modrinthClassicFallbacksForGameVersion,
  modrinthGameVersionCandidates,
  versionListsAnyGame,
  modrinthCandidateRank,
  pickNewestModrinthVersion,
  glowingOresVariantLabel,
  // OptiFine reconcile slug/jar-test tablolari â€” regresyon testi icin. Slug'lar
  // gercek Modrinth proje slug'lari olmali; yanlis slug (404) reconcile'in bundled
  // bagimliligi silip geri koyamamasina ve oyun cokmesine yol acar.
  OPTIFINE_RECONCILE_SLUGS,
  OPTIFINE_RECONCILE_JAR_TESTS,
};
