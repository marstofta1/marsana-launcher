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
// O4 Ã¢â‚¬â€ Modrinth sÃƒÂ¼rÃƒÂ¼m-seÃƒÂ§im mantÃ„Â±Ã„Å¸Ã„Â± ayrÃ„Â±, baÃ„Å¸Ã„Â±msÃ„Â±z test edilebilir modÃƒÂ¼le taÃ…Å¸Ã„Â±ndÃ„Â±.
// AynÃ„Â± adlarla iÃƒÂ§e alÃ„Â±nÃ„Â±r; tÃƒÂ¼m ÃƒÂ§aÃ„Å¸rÃ„Â± yerleri deÃ„Å¸iÃ…Å¸meden ÃƒÂ§alÃ„Â±Ã…Å¸Ã„Â±r.
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

// Anchor mod'larÃ„Â± ÃƒÂ¶nce yazÃ„Â±yoruz; dependency ÃƒÂ§ÃƒÂ¶zÃƒÂ¼mlemesi onlardan baÃ…Å¸lar,
// bÃƒÂ¶ylece Iris/Continuity istedikleri Sodium sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼nÃƒÂ¼ kilitler.
const SHADER_FPS_SLUGS = Object.freeze(['iris', 'fabric-api']);
const EMBOSSED_SLUGS = Object.freeze(['continuity', 'fabric-api']);
const VOICE_CHAT_SLUG = 'simple-voice-chat';
const CREATE_SLUG = 'create';
// Create kutusu iÃ…Å¸aretlenince Create ile birlikte kurulan, bilerek kÃ„Â±sa tutulmuÃ…Å¸ eklenti
// listesi (disk/RAM/FPS). Ãƒâ€“rtÃƒÂ¼Ã…Å¸enler (Create Generators, Crafts & Additions, dekor
// paketleri) bilerek yok. YalnÃ„Â±zca zorunlu baÃ„Å¸Ã„Â±mlÃ„Â±lÃ„Â±klar ÃƒÂ§ekilir.
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
// Modrinth'te olmayan (ÃƒÂ¶r. incelemede) Create eklentileri: jar launcher'la gelir
// (bundled-mods/create-addons/), hash doÃ„Å¸rulanÃ„Â±p kopyalanÃ„Â±r. Modrinth'e ÃƒÂ§Ã„Â±kÃ„Â±nca
// slug'Ã„Â± CREATE_ADDON_SLUGS'a taÃ…Å¸Ã„Â±, buradan sil.
const CREATE_BUNDLED_ADDONS = Object.freeze([
  Object.freeze({
    slug: 'create-engines',
    file: 'create_engines-1.21.1-0.1.1.jar',
    bundled: 'create-addons/create_engines-1.21.1-0.1.1.jar',
    sha512:
      '3c8357afc7b4e762fb5e5646e48e2a3850dcbc53e9590b467dbc6d9b5021b072fc5d13b98f48736ca1cfe9f2b924db648b13b24c470e1f1f25cd87f45af64a0e',
  }),
]);
// Create modunda FPS/RAM kazancÃ„Â± iÃƒÂ§in kurulan hafif NeoForge optimizasyon modlarÃ„Â±
// (toplam ~4 MB). Hepsi opsiyonel: bulunamazsa atlanÃ„Â±r.
const CREATE_PERF_SLUGS = Object.freeze([
  'sodium',
  'modernfix',
  'immediatelyfast',
  'ferrite-core',
  'entityculling',
  'lithium',
]);
// Create modu ilk kez aÃƒÂ§Ã„Â±ldÃ„Â±Ã„Å¸Ã„Â±nda aÃ„Å¸Ã„Â±r video ayarlarÃ„Â±nÃ„Â± (render mesafesi 32 gibi) bir kez
// sÃ„Â±nÃ„Â±rlar; kullanÃ„Â±cÃ„Â± sonra oyun iÃƒÂ§inden yÃƒÂ¼kseltirse tekrar ezilmez.
const NEWLINE_RE = /\r?\n/;
const CREATE_VIDEO_CAPS = Object.freeze({
  renderDistance: 10,
  simulationDistance: 8,
  entityDistanceScaling: 1.0,
  biomeBlendRadius: 3,
  mipmapLevels: 2,
});
// Entegre ekran kartlarÃ„Â±nda GPU darboÃ„Å¸azÃ„Â±: gÃƒÂ¶lge ve Flywheel'in aÃ„Å¸Ã„Â±r Ã„Â±Ã…Å¸Ã„Â±k/compute yolu.
const CREATE_VIDEO_FORCE = Object.freeze({ entityShadows: 'false' });
// Tek oyunculu yerleÃ…Å¸ik sunucu simÃƒÂ¼lasyon mesafesi bÃƒÂ¼yÃƒÂ¼kse (Create makineleri, Aeronautics
// fiziÃ„Å¸i) sunucu iÃ…Å¸ parÃƒÂ§acÃ„Â±Ã„Å¸Ã„Â± yetiÃ…Å¸emez ("Can't keep up"). Ekranda gÃƒÂ¶rÃƒÂ¼nmez; her aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸ta sÃ„Â±nÃ„Â±rlanÃ„Â±r.
const CREATE_SIMULATION_DISTANCE_MAX = 8;
// Vanilla render mesafesi ÃƒÂ¼st sÃ„Â±nÃ„Â±rÃ„Â±: 32 chunk yerleÃ…Å¸ik sunucuyu chunk ÃƒÂ¼retimiyle boÃ„Å¸uyor
// ("Can't keep up") ve ekran kartÃ„Â±nÃ„Â± yoruyor. Distant Horizons denendi ama uzak arazi gÃƒÂ¶rÃƒÂ¼ntÃƒÂ¼sÃƒÂ¼
// beÃ„Å¸enilmedi (blok blok), bu yÃƒÂ¼zden pakette yok; 12 chunk net ve akÃ„Â±cÃ„Â±.
const CREATE_RENDER_DISTANCE_MAX = 12;
// HazÃ„Â±r mod paketleri (Tam Paket / FPS Paketi) iÃƒÂ§in Fabric FPS/RAM modlarÃ„Â±. Hepsi opsiyonel:
// seÃƒÂ§ili Minecraft sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼nde uygun sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ yoksa atlanÃ„Â±r.
const FPS_BOOST_SLUGS = Object.freeze([
  'lithium',
  'ferrite-core',
  'immediatelyfast',
  'entityculling',
  'modernfix',
  'dynamic-fps',
]);
// Paket ilk kez aÃƒÂ§Ã„Â±ldÃ„Â±Ã„Å¸Ã„Â±nda render mesafesi bu deÃ„Å¸ere ayarlanÃ„Â±r (sonra oyun iÃƒÂ§inden deÃ„Å¸iÃ…Å¸tirilebilir).
const FPS_BOOST_RENDER_DISTANCE = 12;
// Vanilla varsayÃ„Â±lanÃ„Â± maxFps:120 Ã¢â‚¬â€ FPS modlarÃ„Â± ne kazandÃ„Â±rÃ„Â±rsa kazandÃ„Â±rsÃ„Â±n sayaÃƒÂ§ 120'de takÃ„Â±lÃ„Â±r.
// 260 = oyundaki "SÃ„Â±nÃ„Â±rsÃ„Â±z".
// FPS Paketi sÃ„Â±nÃ„Â±rÃ„Â± kaldÃ„Â±rÃ„Â±r ('unlimited'); Tam Paket 120'de sabit tutar ('capped').
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
// Zorlanan ayar listesi deÃ„Å¸iÃ…Å¸ince artÃ„Â±r: mevcut kurulumlarda ayar bir kez daha uygulanÃ„Â±r.
const FPS_BOOST_TUNE_VERSION = 4;
// Paket dÃ„Â±Ã…Å¸Ã„Â±nda (Create dahil) geri alÃ„Â±nan ayarlar ve ÃƒÂ¶nceki deÃ„Å¸er bilinmiyorsa dÃƒÂ¶nÃƒÂ¼lecek vanilla varsayÃ„Â±lanÃ„Â±.
// options.txt tÃƒÂ¼m yÃƒÂ¼kleyicilerde ortak; geri alÃ„Â±nmazsa sÃ„Â±nÃ„Â±rsÃ„Â±z FPS diÃ„Å¸er profillere de sÃ„Â±zar.
const FPS_BOOST_RESTORE_DEFAULTS = Object.freeze({ maxFps: '120' });
const FPS_BOOST_MARKER_FILE = '.marsana-fps-pack.json';
const FLYWHEEL_CONFIG_REL = path.join('config', 'flywheel-client.toml');
// Launcher'Ã„Â±n indirdiÃ„Å¸i Create jar'larÃ„Â±nÃ„Â±n adlarÃ„Â± burada tutulur; seÃƒÂ§im kaldÃ„Â±rÃ„Â±ldÃ„Â±Ã„Å¸Ã„Â±nda
// yalnÃ„Â±zca bu jar silinir, kullanÃ„Â±cÃ„Â±nÃ„Â±n elle koyduÃ„Å¸u Create'e dokunulmaz.
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

// UI'dan gelen shader slug'Ã„Â±nÃ„Â± kabul edilen deÃ„Å¸erlere kÃ„Â±s Ã¢â‚¬â€ geÃƒÂ§ersiz/eski bir
// slug Modrinth'te 404'e dÃƒÂ¶nÃƒÂ¼p tÃƒÂ¼m launch'u patlatabilir. TanÃ„Â±nmayan slug
// iÃƒÂ§in sessizce default'a dÃƒÂ¼Ã…Å¸.
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

// Modrinth dosya adlarÃ„Â± (AstraLex vb.) Ã‚Â§ kodlarÃ„Â± iÃƒÂ§erebiliyor. Yerel diskte
// her zaman slug.zip kullan Ã¢â‚¬â€ Iris eÃ…Å¸leÃ…Å¸mesi ve ÃƒÂ¶nbellek tutarlÃ„Â± kalÃ„Â±r.
function shaderPackLocalName(slug) {
  return `${resolveShaderSlug(slug)}.zip`;
}

function isModrinthNotFound(err) {
  return err instanceof LauncherError && err.code === Codes.MODRINTH_NOT_FOUND;
}

// (Modrinth sÃƒÂ¼rÃƒÂ¼m-seÃƒÂ§im yardÃ„Â±mcÃ„Â±larÃ„Â± modrinthVersionSelect.js'e taÃ…Å¸Ã„Â±ndÃ„Â± Ã¢â‚¬â€ yukarÃ„Â±da
//  require ile aynÃ„Â± adlarla iÃƒÂ§e alÃ„Â±nÃ„Â±r.)

// Modrinth'te en yeni sÃƒÂ¼rÃƒÂ¼m "Border" (yalnÃ„Â±zca Continuity); OptiFine yolu "Default" ister.
// 1.21.9+ ve 26.x: pack.mcmeta min_format/max_format zorunlu; Modrinth paketleri
// eski pack_format + supported_formats ile gelince oyun baÃ…Å¸langÃ„Â±ÃƒÂ§ta paketi siliyor.
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
  // 1.21.9+ oyunlarÃ„Â± geniÃ…Å¸ min/max aralÃ„Â±Ã„Å¸Ã„Â±nÃ„Â± (ÃƒÂ¶r. 55Ã¢â‚¬â€œ84) reddedip options.txt'ten
  // silebiliyor; hedef sÃƒÂ¼rÃƒÂ¼mle birebir eÃ…Å¸leÃ…Å¸me gerekir.
  return (
    min === format &&
    max === format &&
    pack.pack_format == null &&
    pack.supported_formats == null
  );
}

// 1.21.9 öncesi oyunlar pack.mcmeta'da pack_format ister; yoksa paketi hiç yüklemez
// ("Couldn't load pack metadata"). Aynı zip önce 26.x için min/max_format'a
// yamalanıp sonra eski bir sürümde açılınca bu olur — geri yamalamak gerekir.
const LEGACY_FALLBACK_PACK_FORMAT = 34;

function patchResourcePackZipForGameVersion(zipPath, gameVersion) {
  const modern = gameUsesModernResourcePackFormat(gameVersion);
  const format = modern
    ? resourcePackFormatForGameVersion(gameVersion)
    : resourcePackFormatForGameVersion(gameVersion) ?? LEGACY_FALLBACK_PACK_FORMAT;
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
  const description = pack.description != null ? pack.description : 'Resource pack';
  if (modern) {
    if (packAlreadySupportsGameFormat(pack, format)) return false;
    meta.pack = { description, min_format: format, max_format: format };
  } else {
    // Paketin kendi pack_format'ı varsa dokunma (orijinal Modrinth paketi).
    if (typeof pack.pack_format === 'number') return false;
    meta.pack = { description, pack_format: format };
  }

  // adm-zip writeZip() mevcut arÃ…Å¸ivi yerinde gÃƒÂ¼ncellerken bazÃ„Â± paketleri (3D crops vb.)
  // bozabiliyor; ÃƒÂ§Ã„Â±kar Ã¢â€ â€™ pack.mcmeta yaz Ã¢â€ â€™ yeniden zip'le akÃ„Â±Ã…Å¸Ã„Â± gÃƒÂ¼venli.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-rp-'));
  const tmpOut = `${zipPath}.marsana-patch.tmp`;
  try {
    // Kaynak paketi Modrinth'ten indirilmiÃ…Å¸ uzak bir zip; girdi adlarÃ„Â± gÃƒÂ¼venilmez.
    // adm-zip'in extractAllTo'su yerine kendi kapsama kontrolÃƒÂ¼mÃƒÂ¼z kullanÃ„Â±lÃ„Â±r.
    // GÃƒÂ¼vensiz bir girdi ÃƒÂ§Ã„Â±karsa hata fÃ„Â±rlar, aÃ…Å¸aÃ„Å¸Ã„Â±daki catch paketi olduÃ„Å¸u gibi
    // bÃ„Â±rakÃ„Â±r (yama uygulanmaz) Ã¢â‚¬â€ bozuk paket yerine yamasÃ„Â±z paket tercih edilir.
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
    if (isKnown || /Ã‚Â§|Ãƒâ€šÃ‚Â§/.test(entry)) {
      removeIfExists(path.join(shaderpacksDir, entry));
    }
  }
}

function isCorruptShaderPackName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  return /Ã‚Â§|Ãƒâ€šÃ‚Â§|\u00C2\u00A7|\\u00C2\\u00A7|LexBoosT/i.test(s);
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
    // OptiFine paketi kendi optimizasyon modlarÃ„Â±nÃ„Â± getirir; ikisi birlikte ÃƒÂ§ift jar ÃƒÂ¼retir.
    // KullanÃ„Â±cÃ„Â±nÃ„Â±n "Mod ekle" ile eklediÃ„Å¸i, bu seÃƒÂ§imde yÃƒÂ¼klenecek mod var.
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

// YalnÃ„Â±zca ÃƒÂ¶n sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ gÃƒÂ¼ncel olan modlar: Steam 'n' Rails 1.21.1 portunun son "release"i
// (0.2.1) eski kalÃ„Â±yor, gÃƒÂ¼ncel iÃƒÂ§erik beta kanalÃ„Â±nda yayÃ„Â±nlanÃ„Â±yor.
const PRERELEASE_MOD_SLUGS = new Set(['create-steam-n-rails-1.21.1']);

const OPTIONAL_LOADER_MOD_SLUGS = new Set([POLYTONE_SLUG, ...CLIENT_HUD_MOD_SLUGS]);

function usesStrictModrinthPatch(gameVersion) {
  const id = String(gameVersion || '').trim();
  return /^\d+\.\d+\.\d+$/.test(id) && !/^26\./.test(id);
}

function polytoneSupportedForGameVersion(gameVersion) {
  // Polytone Modrinth'te en fazla 1.21.11'e kadar; 26.x iÃƒÂ§in native jar yok.
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
  // Better Leaves kaynak paketi tek baÃ…Å¸Ã„Â±na yetmez; Cull Leaves (veya OptiFine Smart Leaves) gerekir.
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

// OptiFine modpack'i Continuity gibi opsiyonel modlarÃ„Â± `*.jar.disabled` olarak
// getiriyor. KullanÃ„Â±cÃ„Â± "kabartma" preset'ini de seÃƒÂ§tiyse bu modlarÃ„Â± etkinleÃ…Å¸tir.
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

/** OptiFine paketinde rrls vb. ile cakisan modlar Ã¢â‚¬â€ kaldirilir, yeniden indirilmez. */
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

// Continuity'nin yan-yana baÃ„Å¸lÃ„Â± doku (CTM) etkisi ancak built-in resource
// pack'leri Minecraft'Ã„Â±n `options.txt` `resourcePacks` listesinde yer aldÃ„Â±Ã„Å¸Ã„Â±nda
// gÃƒÂ¶rÃƒÂ¼nÃƒÂ¼r. Mod yokken Minecraft bu paketleri otomatik kaldÃ„Â±rÃ„Â±yor, mod tekrar
// yÃƒÂ¼klendiÃ„Å¸inde geri eklemiyor.
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
  // Round Trees diÃ„Å¸er paketlerin ÃƒÂ¼stÃƒÂ¼nde olmalÃ„Â± (Modrinth ÃƒÂ¶nerisi).
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
    // Eski bundle'larda alan yok; yok = kapalÃ„Â±.
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
        /* OptiFine paketindeki yardimci mod bu surumde yoksa atla Ã¢â‚¬â€ kirli jar zaten silindi */
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
    status('Zoom (C) iÃƒÂ§in Zoomify kuruluyor Ã¢â‚¬â€ resmi OptiFine 26.x henÃƒÂ¼z yok.');
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
      (existing.shaderpacks || []).some((name) => /Ã‚Â§/.test(String(name))) ||
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

  // MCLC, Minecraft 1.21+'in numerik asset index ID'sini (ÃƒÂ¶rn. "30") gameVersion
  // adÃ„Â±yla kaydedebiliyor; sonuÃƒÂ§ olarak oyun aradÃ„Â±Ã„Å¸Ã„Â± `<id>.json`'u bulamayÃ„Â±p
  // panorama, diller ve sesleri yÃƒÂ¼kleyemiyor. Eksikse Mojang'dan indirip
  // doÃ„Å¸ru isimle yerleÃ…Å¸tir.
  async function ensureAssetIndexFile({ gameRoot, assetIndex }) {
    if (!assetIndex || !assetIndex.id || !assetIndex.url) return;
    const indexesDir = path.join(gameRoot, 'assets', 'indexes');
    await fs.promises.mkdir(indexesDir, { recursive: true });
    // assetIndex.id uzak Mojang JSON'undan geliyor; dosya adÃ„Â±na doÃ„Å¸rudan gÃƒÂ¶mÃƒÂ¼lÃƒÂ¼yor.
    const targetPath = assertInside(
      indexesDir,
      `${assetIndex.id}.json`,
      `Asset index adÃ„Â± gÃƒÂ¼venli deÃ„Å¸il: "${assetIndex.id}".`
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

  // Mojang'Ã„Â±n base sÃƒÂ¼rÃƒÂ¼mleri (1.20, 1.21, 1.19) iÃƒÂ§in mod ekosistemi genelde
  // patch sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼nÃƒÂ¼ (1.20.1, 1.21.1, ...) hedefler Ã¢â‚¬â€ base'ten ilk patch'e mod
  // gÃƒÂ¼ncellemesi gelir. Anchor sorgusunu expand edersek Modrinth daha gÃƒÂ¼ncel ve
  // birbiriyle uyumlu sÃƒÂ¼rÃƒÂ¼mleri dÃƒÂ¶ner.
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

  // Modlar arasÃ„Â± "latest" sÃƒÂ¼rÃƒÂ¼mler bazen birbiriyle uyumsuz olabilir (ÃƒÂ¶rn. Iris
  // 1.6.11 Modrinth manifest'inde Sodium 0.5.7'yi gÃƒÂ¶sterir ama jar iÃƒÂ§indeki
  // breaks Sodium >=0.5.7'yi ÃƒÂ§akÃ„Â±Ã…Å¸malÃ„Â± sayar). Ãƒâ€¡ÃƒÂ¶zÃƒÂ¼m katmanlarÃ„Â±:
  //  - gameVersion'Ã„Â± patch ile expand et Ã¢â‚¬â€ yeni anchor'lar gelir.
  //  - Anchor mod (Iris/Continuity) ÃƒÂ¶nce ÃƒÂ§ek.
  //  - Anchor'Ã„Â±n Modrinth `dependencies` listesindeki spesifik `version_id`'leri
  //    indir; null ise anchor'Ã„Â±n yayÃ„Â±n tarihinden ÃƒÂ¶nceki en son uyumlu sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼
  //    al (contemporary heuristic).
  //  - AynÃ„Â± projenin tekrar indirilmesini engellemek iÃƒÂ§in downloaded set tutulur.
  // skipExisting: diskte aynÃ„Â± boyutta jar varsa yeniden indirme (her aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸ta ~50 MB'lÃ„Â±k
  // paketi ÃƒÂ§ekmemek iÃƒÂ§in). optionalSlugs: bu slug'lar iÃƒÂ§in uygun sÃƒÂ¼rÃƒÂ¼m yoksa atla.
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
      // file.filename Modrinth'ten geliyor; yol bileÃ…Å¸eni iÃƒÂ§erebilir. mrpackInstaller
      // aynÃ„Â± alanda path.basename uyguluyor Ã¢â‚¬â€ burada da modsDir dÃ„Â±Ã…Å¸Ã„Â±na ÃƒÂ§Ã„Â±kÃ„Â±Ã…Å¸Ã„Â± engelle.
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
            `Modrinth: "${slug}" iÃƒÂ§in uygun sÃƒÂ¼rÃƒÂ¼m bulunamadÃ„Â±.`
          );
        }
      } catch (err) {
        if (OPTIONAL_LOADER_MOD_SLUGS.has(slug) || (optionalSlugs && optionalSlugs.has(slug))) continue;
        if (err && err.code === Codes.MODRINTH_NOT_FOUND) {
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Bu Minecraft sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ (${gameVersion}) iÃƒÂ§in "${slug}" modunun ${loaderFilter.join('/')} uyumlu sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ Modrinth'te yok. ` +
              'Snapshot/henÃƒÂ¼z yayÃ„Â±nlanmamÃ„Â±Ã…Å¸ sÃƒÂ¼rÃƒÂ¼mlerde bu modlar olmaz Ã¢â‚¬â€ stable bir release (ÃƒÂ¶rn. 1.21.4, 1.20.1) seÃƒÂ§in.'
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
          onNotice(`Shader paketi hazÃ„Â±r: ${safeName}`);
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
          `"${slug}" bu Minecraft sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼nde bulunamadÃ„Â± Ã¢â‚¬â€ Complementary Reimagined kullanÃ„Â±lÃ„Â±yor.`
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

  // Iris shader paketi otomatik aktivasyonu: indirilen pack zaten varsa kullanÃ„Â±cÃ„Â±nÃ„Â±n
  // Options Ã¢â€ â€™ Video Ã¢â€ â€™ Shader Packs menÃƒÂ¼sÃƒÂ¼ne girip seÃƒÂ§mesi gerekmesin. Iris ilk aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸ta
  // boÃ…Å¸ bir `shaderPack=` yazÃ„Â±yor; mevcut satÃ„Â±rÃ„Â± (varsa) gÃƒÂ¼ncelle, yoksa ekle.
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

  // Oculus (Iris'in Forge/NeoForge fork'u) kendi config dosyasÃ„Â±nÃ„Â± kullanÃ„Â±r:
  // `config/oculus.properties`. Format Iris ile aynÃ„Â±.
  function activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'oculus.properties'), shaderpackFilename);
  }

  // OptiFine'Ã„Â±n shader config dosyasÃ„Â± ayrÃ„Â±: `optionsshaders.txt`. Format ana
  // options.txt'e benzer ama OptiFine bunu shader pack seÃƒÂ§imi iÃƒÂ§in okur.
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

  // Forge / NeoForge iÃƒÂ§in launch ÃƒÂ¶ncesi eski shader mod jar'larÃ„Â±nÃ„Â± temizle.
  // AynÃ„Â± kategoride iki sÃƒÂ¼rÃƒÂ¼m (ÃƒÂ¶rn. Rubidium + Embeddium ya da Oculus + Iris)
  // duplicate hatasÃ„Â± verir Ã¢â‚¬â€ sÃ„Â±fÃ„Â±rdan kuruyoruz ki tutarlÃ„Â± kombinasyon olsun.
  //
  // Ãƒâ€“NEMLÃ„Â°: hem aktif `.jar` hem stash kopyalarÃ„Â±nÃ„Â± siliyoruz. Aksi halde
  // applyLoaderModsState bir sonraki loader geÃƒÂ§iÃ…Å¸inde eski stash'i restore
  // edip eski Rubidium'u geri getirir ve yeni Embeddium ile ÃƒÂ§akÃ„Â±Ã…Å¸Ã„Â±r.
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

  // Forge ailesinde kabartma iÃƒÂ§in yÃƒÂ¶netilen jar'lar: Continuity (Forge/NeoForge).
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

    // Eski shader mod kombinasyonlarÃ„Â±nÃ„Â± temizle Ã¢â‚¬â€ duplicate riskini ÃƒÂ¶nler.
    if (loader === 'forge' || loader === 'neoforge') {
      cleanupForgeFamilyShaderJars(modsDir);
    }

    if (loader === 'forge-optifine') {
      status('Shader paketi indiriliyor (OptiFine iÃƒÂ§in)...');
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

    // Anchor mod yeterli Ã¢â‚¬â€ Modrinth'in `dependencies` listesi Sodium/Embeddium
    // gibi gerekli baÃ„Å¸Ã„Â±mlÃ„Â±lÃ„Â±klarÃ„Â± zaten getiriyor. Ek slug yazarsak bir
    // projenin iki sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼nÃƒÂ¼ (ÃƒÂ¶rn. Rubidium + Embeddium) yan yana indirebiliriz
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

    status(`Shader modlarÃ„Â± indiriliyor (${loader})...`);
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
      loaders: ['iris'], // Oculus de Iris API'sini kullanÃ„Â±r, aynÃ„Â± paket
      shaderSlug,
      onNotice: status,
    });
    if (packs[0]) {
      if (loader === 'forge') {
        // Oculus kendi config dosyasÃ„Â±nÃ„Â± okur (oculus.properties), iris.properties deÃ„Å¸il.
        activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename: packs[0] });
      } else {
        // NeoForge ve Quilt: gerÃƒÂ§ek Iris mod'u Ã¢â€ â€™ iris.properties
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
        `${label} bu Minecraft sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ (${gameVersion}) iÃƒÂ§in Modrinth'te bulunamadÃ„Â±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, `${label} dosyasÃ„Â± Modrinth'te bulunamadÃ„Â±.`);
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, localName), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
    const versionLabel = picked.name || picked.version_number || label;
    if (onNotice) onNotice(`${label} ${versionLabel} hazÃ„Â±r: ${localName}`);
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
        `New Glowing Ores bu Minecraft sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ (${gameVersion}) iÃƒÂ§in Modrinth'te bulunamadÃ„Â±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'New Glowing Ores dosyasÃ„Â± Modrinth\'te bulunamadÃ„Â±.');
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
    if (onNotice) onNotice(`New Glowing Ores ${variantLabel} hazÃ„Â±r: ${GLOWING_ORES_PACK_LOCAL_NAME}`);
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
        `Fullbright UB bu Minecraft sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ (${gameVersion}) iÃƒÂ§in Modrinth/CurseForge'ta bulunamadÃ„Â±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'Fullbright UB dosyasÃ„Â± Modrinth\'te bulunamadÃ„Â±.');
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, FULLBRIGHT_PACK_LOCAL_NAME), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({
      resourcepacksDir,
      localName: FULLBRIGHT_PACK_LOCAL_NAME,
      gameVersion,
    });

    const label = picked.name || picked.version_number || 'Fullbright UB';
    if (onNotice) onNotice(`Fullbright UB ${label} hazÃ„Â±r: ${FULLBRIGHT_PACK_LOCAL_NAME}`);
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
      status('Fullbright + Shader iÃƒÂ§in PolyTone indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [POLYTONE_SLUG],
          modrinthLoaders: [loader],
        });
      } catch {
        status('PolyTone bulunamadÃ„Â± Ã¢â‚¬â€ Fullbright Sodium/Iris ile ÃƒÂ§alÃ„Â±Ã…Å¸mayabilir.');
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
      status('Better Leaves iÃƒÂ§in Cull Leaves indiriliyor (Sodium/Embeddium baÃ„Å¸Ã„Â±mlÃ„Â±lÃ„Â±klarÃ„Â± otomatik)...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CULL_LEAVES_SLUG],
          modrinthLoaders: [modLoader],
        });
      } catch {
        status('Cull Leaves bulunamadÃ„Â± Ã¢â‚¬â€ OptiFine Smart Leaves veya Fabric yÃƒÂ¼kleyici deneyin.');
      }
    } else if (loader === 'vanilla') {
      status(
        "Better Leaves: Vanilla'da tam etki iÃƒÂ§in Fabric + Cull Leaves veya Forge/OptiFine + Smart Leaves kullanÃ„Â±n."
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
      status('Glowing Ores: NeoForge\'da Continuity + Connector gerekir Ã¢â‚¬â€ maden parÃ„Â±ltÃ„Â±sÃ„Â± gÃƒÂ¶rÃƒÂ¼nmeyebilir.');
    } else if (willInstallContinuity) {
      status('Glowing Ores iÃƒÂ§in Continuity indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CONTINUITY_SLUG],
          modrinthLoaders: [modLoader],
        });
        ensureContinuityResourcePacks(gameRoot);
      } catch {
        status('Continuity bulunamadÃ„Â± Ã¢â‚¬â€ OptiFine Emissive Textures veya KabartmalÃ„Â± bloklar (Continuity) gerekir.');
      }
    } else if (includeOptifine) {
      status('Glowing Ores (Default): OptiFine\'da Video AyarlarÃ„Â± Ã¢â€ â€™ Kalite Ã¢â€ â€™ Emissive Textures aÃƒÂ§Ã„Â±n.');
    } else if (loader === 'vanilla') {
      status('Glowing Ores (Default): Vanilla\'da parÃ„Â±ltÃ„Â± iÃƒÂ§in Fabric+Continuity veya Forge+OptiFine kullanÃ„Â±n.');
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

  // Launcher'Ã„Â±n kurduÃ„Å¸u Create jar'larÃ„Â±nÃ„Â± (loader geÃƒÂ§iÃ…Å¸inde stash'lenmiÃ…Å¸ kopyalarÃ„Â±
  // dahil) siler. `keep` listesindeki adlarÃ„Â±n etkin kopyasÃ„Â± korunur.
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

  // Flywheel: compute-shader tabanlÃ„Â± "indirect" backend ve SMOOTH Ã„Â±Ã…Å¸Ã„Â±k, entegre GPU'da
  // pahalÃ„Â±. Dosya ilk oyun aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸Ã„Â±nda oluÃ…Å¸ur; yoksa sonraki aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸ta denenir.
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

  // Her aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸ta: render/simÃƒÂ¼lasyon mesafesi ÃƒÂ¼st sÃ„Â±nÃ„Â±rÃ„Â± aÃ…Å¸Ã„Â±yorsa dÃƒÂ¼Ã…Å¸ÃƒÂ¼rÃƒÂ¼r (altÃ„Â±ndakilere dokunmaz).
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

  // options.txt'te ÃƒÂ¼st sÃ„Â±nÃ„Â±rÃ„Â± aÃ…Å¸an deÃ„Å¸erleri dÃƒÂ¼Ã…Å¸ÃƒÂ¼rÃƒÂ¼r; sÃ„Â±nÃ„Â±rÃ„Â±n altÃ„Â±ndakilere dokunmaz.
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

  // HazÃ„Â±r paketlerin video ayarÃ„Â±: render mesafesi 12'ye ayarlanÃ„Â±r, aÃ„Å¸Ã„Â±r ayarlar sÃ„Â±nÃ„Â±rlanÃ„Â±r.
  // Paket baÃ…Å¸Ã„Â±na bir kez uygulanÃ„Â±r; paket kapatÃ„Â±lÃ„Â±nca iÃ…Å¸aret silinir, yeniden seÃƒÂ§ilince tekrar uygulanÃ„Â±r.
  function syncFpsBoostVideoOptions({ gameRoot, modsDir, enabled, unlimited, status }) {
    const markerPath = path.join(modsDir, FPS_BOOST_MARKER_FILE);
    const optionsPath = path.join(gameRoot, 'options.txt');
    let marker = null;
    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    } catch {
      /* iÃ…Å¸aret yok ya da bozuk */
    }
    let text = '';
    try {
      text = fs.readFileSync(optionsPath, 'utf8');
    } catch {
      /* ilk kurulum: options.txt henÃƒÂ¼z yok */
    }
    if (!enabled) {
      if (!marker) return;
      // YalnÃ„Â±zca paketin yazdÃ„Â±Ã„Å¸Ã„Â± deÃ„Å¸er hÃƒÂ¢lÃƒÂ¢ duruyorsa geri al; kullanÃ„Â±cÃ„Â± oyun iÃƒÂ§inden deÃ„Å¸iÃ…Å¸tirdiyse dokunma.
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

    // "Ãƒâ€“nceki deÃ„Å¸er" yalnÃ„Â±zca paket ilk uygulandÃ„Â±Ã„Å¸Ã„Â±nda dosyadan okunur; paketler arasÃ„Â± geÃƒÂ§iÃ…Å¸te
    // dosyadaki deÃ„Å¸er ÃƒÂ¶teki paketin yazdÃ„Â±Ã„Å¸Ã„Â±dÃ„Â±r, eski iÃ…Å¸aretteki korunur.
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
    status('Paket: render mesafesi ' + FPS_BOOST_RENDER_DISTANCE + ' chunk yapÃ„Â±ldÃ„Â±, ' + (unlimited ? 'FPS sÃ„Â±nÃ„Â±rÃ„Â± kaldÃ„Â±rÃ„Â±ldÃ„Â±' : 'FPS sÃ„Â±nÃ„Â±rÃ„Â± 120 yapÃ„Â±ldÃ„Â±') + ', aÃ„Å¸Ã„Â±r video ayarlarÃ„Â± dÃƒÂ¼Ã…Å¸ÃƒÂ¼rÃƒÂ¼ldÃƒÂ¼ (oyun iÃƒÂ§inden deÃ„Å¸iÃ…Å¸tirilebilir).');
  }

  function releaseFpsBoostVideoOptions(gameRoot) {
    syncFpsBoostVideoOptions({ gameRoot, modsDir: path.join(gameRoot, 'mods'), enabled: false });
  }

  // Create + kÃƒÂ¼ratÃƒÂ¶rlÃƒÂ¼ eklenti listesi (CREATE_ADDON_SLUGS). ArayÃƒÂ¼z bu seÃƒÂ§eneÃ„Å¸i NeoForge
  // 1.21.1'e sabitler. GÃƒÂ¼ncel jar'lar yeniden indirilmez; Modrinth'e ulaÃ…Å¸Ã„Â±lamazsa kurulu
  // jar'larla devam edilir (tek oyunculu, ÃƒÂ§evrimdÃ„Â±Ã…Å¸Ã„Â± aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸). Taban Create bulunamazsa
  // hata verilir; bir eklentinin uygun sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ yoksa o eklenti sessizce atlanÃ„Â±r.
  //
  // `serverPack`: Klima SMP paketi Ã¢â‚¬â€ Create ve eklentileri sunucuyla aynÃ„Â±
  // sabit sÃƒÂ¼rÃƒÂ¼mden kurulur (NeoForge kayÃ„Â±t eÃ…Å¸leÃ…Å¸mesi), yalnÃ„Â±zca FPS modlarÃ„Â± gÃƒÂ¼ncel ÃƒÂ§ekilir.
  async function installCreateForExternalLoader({ loader, gameRoot, gameVersion, emit, serverPack = false }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    const previous = readManagedCreateJars(modsDir);
    // Sunucu paketinde ÃƒÂ§evrimdÃ„Â±Ã…Å¸Ã„Â± yedek yalnÃ„Â±zca sabit jar'lar zaten kuruluysa kullanÃ„Â±lÃ„Â±r:
    // normal Create paketinin eklentileriyle sunucuya baÃ„Å¸lanÃ„Â±lamaz.
    const previousOnDisk =
      previous.length > 0 &&
      previous.every((j) => fs.existsSync(path.join(modsDir, j))) &&
      (!serverPack || MARSANA_SERVER_PINNED_MODS.every((m) => previous.includes(m.file)));

    status(serverPack ? 'Klima SMP paketi hazÃ„Â±rlanÃ„Â±yor...' : 'Create ve eklentileri hazÃ„Â±rlanÃ„Â±yor...');
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
        // Launcher'la gelen eklentiler; taban Create kurulduysa eklenir, jar eksikse atlanÃ„Â±r.
        if (jars.length > 0) {
          for (const addon of CREATE_BUNDLED_ADDONS) {
            try {
              const [jar] = await downloadPinnedMods(modsDir, [addon]);
              if (!jars.includes(jar)) jars.push(jar);
            } catch (err) {
              status('Create: ' + addon.file + ' atlandÃ„Â± (' + err.message + ').');
            }
          }
        }
      }
    } catch (err) {
      if (previousOnDisk) {
        status("Create: Modrinth'e ulaÃ…Å¸Ã„Â±lamadÃ„Â± Ã¢â‚¬â€ kurulu sÃƒÂ¼rÃƒÂ¼mlerle devam ediliyor.");
        return { jars: previous };
      }
      throw err;
    }

    if (jars.length === 0) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Create modunun ${loader} ${gameVersion} uyumlu sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼ Modrinth'te bulunamadÃ„Â±.`
      );
    }
    if (capCreateDistances(gameRoot)) {
      status('Create: render mesafesi en fazla ' + CREATE_RENDER_DISTANCE_MAX + ', simÃƒÂ¼lasyon mesafesi en fazla ' + CREATE_SIMULATION_DISTANCE_MAX + ' (takÃ„Â±lmayÃ„Â± ÃƒÂ¶nler).');
    }
    const marker = readCreateMarker(modsDir);
    let tuned = marker.tuned;
    let flywheelTuned = marker.flywheelTuned;
    if (!flywheelTuned) {
      const r = tuneFlywheelConfig(gameRoot);
      if (r !== null) {
        flywheelTuned = true;
        if (r) status('Create: Flywheel hafif moda alÃ„Â±ndÃ„Â± (entegre ekran kartÃ„Â± iÃƒÂ§in).');
      }
    }
    if (!tuned) {
      if (capCreateVideoOptions(gameRoot)) {
        status('Create: render mesafesi ve benzeri aÃ„Å¸Ã„Â±r video ayarlarÃ„Â± FPS iÃƒÂ§in dÃƒÂ¼Ã…Å¸ÃƒÂ¼rÃƒÂ¼ldÃƒÂ¼ (oyun iÃƒÂ§inden deÃ„Å¸iÃ…Å¸tirilebilir).');
      }
      tuned = true;
    }
    // Listeden ÃƒÂ§Ã„Â±kan / gÃƒÂ¼ncellenen eski jar'larÃ„Â± sil, marker'Ã„Â± tÃƒÂ¼m yeni jar'larla yaz.
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

  // Sabit sÃƒÂ¼rÃƒÂ¼mlÃƒÂ¼ jar'larÃ„Â± indirir; diskte aynÃ„Â± hash'le duranlar yeniden indirilmez.
  async function downloadPinnedMods(modsDir, mods) {
    await fs.promises.mkdir(modsDir, { recursive: true });
    const jars = [];
    for (const mod of mods) {
      const safeName = path.basename(String(mod.file || ''));
      const destPath = assertInside(modsDir, safeName);
      if (sha512OfFile(destPath) !== mod.sha512) {
        if (mod.bundled) {
          // Modrinth'te olmayan (ÃƒÂ¶r. incelemede) mod: launcher'la gelen jar kopyalanÃ„Â±r.
          const src = repoRoot ? path.join(repoRoot, 'bundled-mods', mod.bundled) : null;
          if (!src || sha512OfFile(src) !== mod.sha512) {
            throw new LauncherError(
              Codes.MODRINTH_NOT_FOUND,
              `Klima SMP modu launcher iÃƒÂ§inde bulunamadÃ„Â±: ${safeName}`
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

  // Forge ailesi loader'lar iÃƒÂ§in kabartmalÃ„Â± blok (CTM) modunu yÃƒÂ¼kle.
  //   'forge'           Ã¢â€ â€™ Continuity Forge (sadece 1.20.1; Modrinth'te tek sÃƒÂ¼rÃƒÂ¼m)
  //   'neoforge'        Ã¢â€ â€™ Continuity NeoForge (sadece 1.21.1; tek sÃƒÂ¼rÃƒÂ¼m)
  //   'forge-optifine'  Ã¢â€ â€™ no-op (OptiFine kendi iÃƒÂ§inde CTM destekler)
  async function installEmbossedForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);

    if (loader === 'forge-optifine') {
      status('Kabartma: OptiFine kendi iÃƒÂ§inde baÃ„Å¸lÃ„Â± doku desteÃ„Å¸i saÃ„Å¸lÃ„Â±yor Ã¢â‚¬â€ ek mod indirilmedi.');
      return { jars: [] };
    }
    if (loader === 'neoforge') {
      // NeoForge'da Continuity native deÃ„Å¸il Ã¢â‚¬â€ sadece Sinytra Connector ile
      // ÃƒÂ§alÃ„Â±Ã…Å¸an Fabric jar'Ã„Â± ve bu kombinasyon NeoForge 21.1.x ile
      // ClassCastException (ModFileParser$MixinConfig) atÃ„Â±yor. Indirmeyi
      // atla, kullanÃ„Â±cÃ„Â±yÃ„Â± bilgilendir.
      status('Kabartma: NeoForge bu sÃƒÂ¼rÃƒÂ¼mde Continuity\'yi native desteklemiyor Ã¢â‚¬â€ atlandÃ„Â±.');
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

    // options.txt'e Continuity resource pack'lerini ekle Ã¢â‚¬â€ Continuity 3.0+ kendi
    // built-in resource pack'lerini sunar ama Minecraft options'ta listelenmek
    // zorundadÃ„Â±r, aksi takdirde CTM gÃƒÂ¶rÃƒÂ¼nmez.
    ensureContinuityResourcePacks(gameRoot);

    return { jars };
  }

  async function ensure({ gameRoot, gameVersion, emit, modPresets, shaderSlug, fabricChannel = 'stable', playMode }) {
    const presets = normalizePresets(modPresets);
    if (!presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm && !presets.clientHudPack && !presets.marsanaClientMenu && !presets.sodium && !presets.sodiumExtra && !presets.userMods) {
      throw new Error('shaderStackService.ensure: en az bir mod ÃƒÂ¶nayarÃ„Â± gerekli');
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
      status(`Mod profili (ÃƒÂ¶nbellek): ${resolvedShaderSlug} shader hazÃ„Â±r, baÃ…Å¸latÃ„Â±lÃ„Â±yor...`);
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

    status(`Mod profili: Fabric yÃƒÂ¼kleyici eÃ…Å¸leÃ…Å¸tiriliyor (${gameVersion})...`);
    const { merged, loaderVersion } = await installFabricProfile({
      gameVersion,
      customId,
      versionDir,
      versionJsonPath,
      fabricChannel,
    });
    await ensureAssetIndexFile({ gameRoot, assetIndex: merged.assetIndex });

    status('Mod profili: seÃƒÂ§ilen modlar indiriliyor...');
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
      status('Paket: FPS optimizasyon modlarÃ„Â± indiriliyor (uyumlu olanlar)...');
      try {
        fpsBoostJars = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: FPS_BOOST_SLUGS,
          optionalSlugs: new Set(FPS_BOOST_SLUGS),
        });
      } catch {
        status('Paket: bazÃ„Â± FPS modlarÃ„Â± indirilemedi Ã¢â‚¬â€ kalan modlarla devam ediliyor.');
      }
    }
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    jars = await ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars });
    // Uyumsuz ÃƒÂ§Ã„Â±kÃ„Â±p temizlenen FPS modu bundle'a yazÃ„Â±lmamalÃ„Â±; yoksa ÃƒÂ¶nbellek her aÃƒÂ§Ã„Â±lÃ„Â±Ã…Å¸ta geÃƒÂ§ersiz olur.
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
        ? ' Resmi OptiFine.jar 26.x\'te henÃƒÂ¼z yok; zoom iÃƒÂ§in Zoomify (C) eklendi.'
        : '';
      status(
        `${packLabel} kuruldu.${mc26Note} Video ayarlarÃ„Â± ve shader seÃƒÂ§enekleri paket iÃƒÂ§indeki modlarla gelir; ` +
          'Shader + FPS seÃƒÂ§eneÃ„Å¸iyle birlikte kullanmayÃ„Â±n.'
      );
    } else if (presets.shaderFps && presets.embossedBlocks) {
      status(
        'Mod profili hazÃ„Â±r. Shader: SeÃƒÂ§enekler Ã¢â€ â€™ Video Ã¢â€ â€™ Shader Packs (ComplementaryÃ¢â‚¬â„¢de Performance ÃƒÂ¶nerilir). ' +
          'Kabartma: Continuity + Sodium.'
      );
    } else if (presets.shaderFps) {
      status(
        'Shader + FPS profili hazÃ„Â±r. Oyun iÃƒÂ§inde: SeÃƒÂ§enekler Ã¢â€ â€™ Video Ã¢â€ â€™ Shader Packs; ComplementaryÃ¢â‚¬â„¢de Performance profili ÃƒÂ¶nerilir.'
      );
    } else if (presets.voiceChat) {
      status(
        'Simple Voice Chat kuruldu. Oyunda V tuÃ…Å¸una basarak veya ayarlardan mikrofonu yapÃ„Â±landÃ„Â±rÃ„Â±n; sunucuda da mod gerekir.'
      );
    } else if (presets.fullbrightUb) {
      status(
        fullbrightNeedsPolytone(presets, gameVersion)
          ? 'Fullbright UB kuruldu. Kaynak paketi etkinleÃ…Å¸tirildi; Sodium/Iris ile PolyTone da yÃƒÂ¼klendi.'
          : presets.shaderFps && !presets.optifine && !polytoneSupportedForGameVersion(gameVersion)
            ? 'Fullbright UB kuruldu. 26.x sÃƒÂ¼rÃƒÂ¼mÃƒÂ¼nde PolyTone henÃƒÂ¼z yok Ã¢â‚¬â€ kaynak paketi etkin; tam parlaklÃ„Â±k Sodium/Iris ile sÃ„Â±nÃ„Â±rlÃ„Â± olabilir.'
            : 'Fullbright UB kuruldu. Kaynak paketi indirildi ve SeÃƒÂ§enekler Ã¢â€ â€™ Kaynak paketleri bÃƒÂ¶lÃƒÂ¼mÃƒÂ¼nde etkinleÃ…Å¸tirildi.'
      );
    } else if (presets.betterLeaves) {
      status(
        betterLeavesNeedsCullLeaves(presets)
          ? presets.optifine
            ? "Motschen's Better Leaves kuruldu. OptiFine Ã¢â€ â€™ Video AyarlarÃ„Â± Ã¢â€ â€™ Kalite Ã¢â€ â€™ Smart Leaves aÃƒÂ§Ã„Â±n."
            : "Motschen's Better Leaves kuruldu. Kaynak paketi ve Cull Leaves yÃƒÂ¼klendi."
          : "Motschen's Better Leaves kuruldu. Kaynak paketi etkinleÃ…Å¸tirildi."
      );
    } else if (presets.glowingOres) {
      const borderPack = glowingOresUseContinuityPack({ presets });
      status(
        borderPack
          ? 'New Glowing Ores (Border) kuruldu. Continuity ile parÃ„Â±ltÃ„Â± ve baÃ„Å¸lÃ„Â± ÃƒÂ§erÃƒÂ§eve etkin.'
          : 'New Glowing Ores (Default) kuruldu. OptiFine kullanÃ„Â±yorsanÃ„Â±z Emissive Textures aÃƒÂ§Ã„Â±n.'
      );
    } else if (presets.roundTrees) {
      status('Round Trees kuruldu. Kaynak paketi listenin en ÃƒÂ¼stÃƒÂ¼ne yerleÃ…Å¸tirildi.');
    } else if (presets.crops3d) {
      status('3D crops Revamped kuruldu. TarÃ„Â±m bloklarÃ„Â± 3D gÃƒÂ¶rÃƒÂ¼nÃƒÂ¼me geÃƒÂ§ti.');
    } else if (presets.schematicFarm) {
      status('Sematik Farm modu kuruldu. Oyunda F8 ile farm seÃƒÂ§in, Konumu Ayarla ile baÃ…Å¸langÃ„Â±ÃƒÂ§ noktasÃ„Â±nÃ„Â± belirleyin.');
    } else {
      status('KabartmalÃ„Â± blok / baÃ„Å¸lÃ„Â± doku: Continuity + Sodium hazÃ„Â±r.');
    }

    modIsolationService.enforceModIsolation(modsDir, presets, playMode);
    return { customId, assetIndexId };
  }

  return { ensure, applyModResourcePackPresets, installShadersForExternalLoader, installEmbossedForExternalLoader, installVoiceChatForExternalLoader, installCreateForExternalLoader, removeManagedCreateJars, releaseFpsBoostVideoOptions, installFullbrightForExternalLoader, installBetterLeavesForExternalLoader, installGlowingOresForExternalLoader, installRoundTreesForExternalLoader, installCrops3dForExternalLoader };
}

module.exports = {
  createShaderStackService,
  CREATE_BUNDLED_ADDONS,
  resourcePackFormatForGameVersion,
  patchResourcePackZipForGameVersion,
  // O1/O4 Ã¢â‚¬â€ kritik Modrinth sÃƒÂ¼rÃƒÂ¼m-eÃ…Å¸leÃ…Å¸tirme mantÃ„Â±Ã„Å¸Ã„Â± test edilebilsin diye dÃ„Â±Ã…Å¸a
  // aktarÃ„Â±lÃ„Â±r (davranÃ„Â±Ã…Å¸ DEÃ„ÂÃ„Â°Ã…ÂMEZ; ayrÃ„Â±ca ileride ayrÃ„Â± modÃƒÂ¼le gÃƒÂ¼venli ÃƒÂ§Ã„Â±karÃ„Â±m
  // iÃƒÂ§in test gÃƒÂ¼venlik aÃ„Å¸Ã„Â±). Bu fonksiyonlar saf (yan etkisiz).
  resolveShaderSlug,
  extractMcVersionFromModMeta,
  modrinthLoaderModGameVersionCandidates,
  modrinthClassicFallbacksForGameVersion,
  modrinthGameVersionCandidates,
  versionListsAnyGame,
  modrinthCandidateRank,
  pickNewestModrinthVersion,
  glowingOresVariantLabel,
  // OptiFine reconcile slug/jar-test tablolari Ã¢â‚¬â€ regresyon testi icin. Slug'lar
  // gercek Modrinth proje slug'lari olmali; yanlis slug (404) reconcile'in bundled
  // bagimliligi silip geri koyamamasina ve oyun cokmesine yol acar.
  OPTIFINE_RECONCILE_SLUGS,
  OPTIFINE_RECONCILE_JAR_TESTS,
};
