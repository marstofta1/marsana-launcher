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
// O4 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Modrinth sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m-seÃƒÆ’Ã‚Â§im mantÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â± ayrÃƒâ€Ã‚Â±, baÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±msÃƒâ€Ã‚Â±z test edilebilir modÃƒÆ’Ã‚Â¼le taÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±ndÃƒâ€Ã‚Â±.
// AynÃƒâ€Ã‚Â± adlarla iÃƒÆ’Ã‚Â§e alÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±r; tÃƒÆ’Ã‚Â¼m ÃƒÆ’Ã‚Â§aÃƒâ€Ã…Â¸rÃƒâ€Ã‚Â± yerleri deÃƒâ€Ã…Â¸iÃƒâ€¦Ã…Â¸meden ÃƒÆ’Ã‚Â§alÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±r.
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

// Anchor mod'larÃƒâ€Ã‚Â± ÃƒÆ’Ã‚Â¶nce yazÃƒâ€Ã‚Â±yoruz; dependency ÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â¶zÃƒÆ’Ã‚Â¼mlemesi onlardan baÃƒâ€¦Ã…Â¸lar,
// bÃƒÆ’Ã‚Â¶ylece Iris/Continuity istedikleri Sodium sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼ kilitler.
const SHADER_FPS_SLUGS = Object.freeze(['iris', 'fabric-api']);
const EMBOSSED_SLUGS = Object.freeze(['continuity', 'fabric-api']);
const VOICE_CHAT_SLUG = 'simple-voice-chat';
const CREATE_SLUG = 'create';
// Create kutusu iÃƒâ€¦Ã…Â¸aretlenince Create ile birlikte kurulan, bilerek kÃƒâ€Ã‚Â±sa tutulmuÃƒâ€¦Ã…Â¸ eklenti
// listesi (disk/RAM/FPS). ÃƒÆ’Ã¢â‚¬â€œrtÃƒÆ’Ã‚Â¼Ãƒâ€¦Ã…Â¸enler (Create Generators, Crafts & Additions, dekor
// paketleri) bilerek yok. YalnÃƒâ€Ã‚Â±zca zorunlu baÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±mlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±klar ÃƒÆ’Ã‚Â§ekilir.
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
// Modrinth'te olmayan (ÃƒÆ’Ã‚Â¶r. incelemede) Create eklentileri: jar launcher'la gelir
// (bundled-mods/create-addons/), hash doÃƒâ€Ã…Â¸rulanÃƒâ€Ã‚Â±p kopyalanÃƒâ€Ã‚Â±r. Modrinth'e ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±kÃƒâ€Ã‚Â±nca
// slug'Ãƒâ€Ã‚Â± CREATE_ADDON_SLUGS'a taÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±, buradan sil.
const CREATE_BUNDLED_ADDONS = Object.freeze([
  Object.freeze({
    slug: 'create-engines',
    file: 'create_engines-1.21.1-0.1.1.jar',
    bundled: 'create-addons/create_engines-1.21.1-0.1.1.jar',
    sha512:
      '10fffc883cb70c4b74bd46c7413aa187b7559b1c8981b4713c5f056609e42881b9343b143e866c4b0fd39be36e866d89f23a9d451e9369d36e0d38cf4965d650',
  }),
]);
// Create modunda FPS/RAM kazancÃƒâ€Ã‚Â± iÃƒÆ’Ã‚Â§in kurulan hafif NeoForge optimizasyon modlarÃƒâ€Ã‚Â±
// (toplam ~4 MB). Hepsi opsiyonel: bulunamazsa atlanÃƒâ€Ã‚Â±r.
const CREATE_PERF_SLUGS = Object.freeze([
  'sodium',
  'modernfix',
  'immediatelyfast',
  'ferrite-core',
  'entityculling',
  'lithium',
]);
// Create modu ilk kez aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nda aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±r video ayarlarÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± (render mesafesi 32 gibi) bir kez
// sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rlar; kullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â± sonra oyun iÃƒÆ’Ã‚Â§inden yÃƒÆ’Ã‚Â¼kseltirse tekrar ezilmez.
const NEWLINE_RE = /\r?\n/;
const CREATE_VIDEO_CAPS = Object.freeze({
  renderDistance: 10,
  simulationDistance: 8,
  entityDistanceScaling: 1.0,
  biomeBlendRadius: 3,
  mipmapLevels: 2,
});
// Entegre ekran kartlarÃƒâ€Ã‚Â±nda GPU darboÃƒâ€Ã…Â¸azÃƒâ€Ã‚Â±: gÃƒÆ’Ã‚Â¶lge ve Flywheel'in aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±r Ãƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±k/compute yolu.
const CREATE_VIDEO_FORCE = Object.freeze({ entityShadows: 'false' });
// Tek oyunculu yerleÃƒâ€¦Ã…Â¸ik sunucu simÃƒÆ’Ã‚Â¼lasyon mesafesi bÃƒÆ’Ã‚Â¼yÃƒÆ’Ã‚Â¼kse (Create makineleri, Aeronautics
// fiziÃƒâ€Ã…Â¸i) sunucu iÃƒâ€¦Ã…Â¸ parÃƒÆ’Ã‚Â§acÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â± yetiÃƒâ€¦Ã…Â¸emez ("Can't keep up"). Ekranda gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nmez; her aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rlanÃƒâ€Ã‚Â±r.
const CREATE_SIMULATION_DISTANCE_MAX = 8;
// Vanilla render mesafesi ÃƒÆ’Ã‚Â¼st sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±: 32 chunk yerleÃƒâ€¦Ã…Â¸ik sunucuyu chunk ÃƒÆ’Ã‚Â¼retimiyle boÃƒâ€Ã…Â¸uyor
// ("Can't keep up") ve ekran kartÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± yoruyor. Distant Horizons denendi ama uzak arazi gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼ntÃƒÆ’Ã‚Â¼sÃƒÆ’Ã‚Â¼
// beÃƒâ€Ã…Â¸enilmedi (blok blok), bu yÃƒÆ’Ã‚Â¼zden pakette yok; 12 chunk net ve akÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â±.
const CREATE_RENDER_DISTANCE_MAX = 12;
// HazÃƒâ€Ã‚Â±r mod paketleri (Tam Paket / FPS Paketi) iÃƒÆ’Ã‚Â§in Fabric FPS/RAM modlarÃƒâ€Ã‚Â±. Hepsi opsiyonel:
// seÃƒÆ’Ã‚Â§ili Minecraft sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nde uygun sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ yoksa atlanÃƒâ€Ã‚Â±r.
const FPS_BOOST_SLUGS = Object.freeze([
  'lithium',
  'ferrite-core',
  'immediatelyfast',
  'entityculling',
  'modernfix',
  'dynamic-fps',
]);
// Paket ilk kez aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nda render mesafesi bu deÃƒâ€Ã…Â¸ere ayarlanÃƒâ€Ã‚Â±r (sonra oyun iÃƒÆ’Ã‚Â§inden deÃƒâ€Ã…Â¸iÃƒâ€¦Ã…Â¸tirilebilir).
const FPS_BOOST_RENDER_DISTANCE = 12;
// Vanilla varsayÃƒâ€Ã‚Â±lanÃƒâ€Ã‚Â± maxFps:120 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â FPS modlarÃƒâ€Ã‚Â± ne kazandÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±rsa kazandÃƒâ€Ã‚Â±rsÃƒâ€Ã‚Â±n sayaÃƒÆ’Ã‚Â§ 120'de takÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±r.
// 260 = oyundaki "SÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rsÃƒâ€Ã‚Â±z".
// FPS Paketi sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â± kaldÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±r ('unlimited'); Tam Paket 120'de sabit tutar ('capped').
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
// Zorlanan ayar listesi deÃƒâ€Ã…Â¸iÃƒâ€¦Ã…Â¸ince artÃƒâ€Ã‚Â±r: mevcut kurulumlarda ayar bir kez daha uygulanÃƒâ€Ã‚Â±r.
const FPS_BOOST_TUNE_VERSION = 4;
// Paket dÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±nda (Create dahil) geri alÃƒâ€Ã‚Â±nan ayarlar ve ÃƒÆ’Ã‚Â¶nceki deÃƒâ€Ã…Â¸er bilinmiyorsa dÃƒÆ’Ã‚Â¶nÃƒÆ’Ã‚Â¼lecek vanilla varsayÃƒâ€Ã‚Â±lanÃƒâ€Ã‚Â±.
// options.txt tÃƒÆ’Ã‚Â¼m yÃƒÆ’Ã‚Â¼kleyicilerde ortak; geri alÃƒâ€Ã‚Â±nmazsa sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rsÃƒâ€Ã‚Â±z FPS diÃƒâ€Ã…Â¸er profillere de sÃƒâ€Ã‚Â±zar.
const FPS_BOOST_RESTORE_DEFAULTS = Object.freeze({ maxFps: '120' });
const FPS_BOOST_MARKER_FILE = '.marsana-fps-pack.json';
const FLYWHEEL_CONFIG_REL = path.join('config', 'flywheel-client.toml');
// Launcher'Ãƒâ€Ã‚Â±n indirdiÃƒâ€Ã…Â¸i Create jar'larÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±n adlarÃƒâ€Ã‚Â± burada tutulur; seÃƒÆ’Ã‚Â§im kaldÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nda
// yalnÃƒâ€Ã‚Â±zca bu jar silinir, kullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±n elle koyduÃƒâ€Ã…Â¸u Create'e dokunulmaz.
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

// UI'dan gelen shader slug'Ãƒâ€Ã‚Â±nÃƒâ€Ã‚Â± kabul edilen deÃƒâ€Ã…Â¸erlere kÃƒâ€Ã‚Â±s ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â geÃƒÆ’Ã‚Â§ersiz/eski bir
// slug Modrinth'te 404'e dÃƒÆ’Ã‚Â¶nÃƒÆ’Ã‚Â¼p tÃƒÆ’Ã‚Â¼m launch'u patlatabilir. TanÃƒâ€Ã‚Â±nmayan slug
// iÃƒÆ’Ã‚Â§in sessizce default'a dÃƒÆ’Ã‚Â¼Ãƒâ€¦Ã…Â¸.
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

// Modrinth dosya adlarÃƒâ€Ã‚Â± (AstraLex vb.) Ãƒâ€šÃ‚Â§ kodlarÃƒâ€Ã‚Â± iÃƒÆ’Ã‚Â§erebiliyor. Yerel diskte
// her zaman slug.zip kullan ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Iris eÃƒâ€¦Ã…Â¸leÃƒâ€¦Ã…Â¸mesi ve ÃƒÆ’Ã‚Â¶nbellek tutarlÃƒâ€Ã‚Â± kalÃƒâ€Ã‚Â±r.
function shaderPackLocalName(slug) {
  return `${resolveShaderSlug(slug)}.zip`;
}

function isModrinthNotFound(err) {
  return err instanceof LauncherError && err.code === Codes.MODRINTH_NOT_FOUND;
}

// (Modrinth sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m-seÃƒÆ’Ã‚Â§im yardÃƒâ€Ã‚Â±mcÃƒâ€Ã‚Â±larÃƒâ€Ã‚Â± modrinthVersionSelect.js'e taÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±ndÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â yukarÃƒâ€Ã‚Â±da
//  require ile aynÃƒâ€Ã‚Â± adlarla iÃƒÆ’Ã‚Â§e alÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±r.)

// Modrinth'te en yeni sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m "Border" (yalnÃƒâ€Ã‚Â±zca Continuity); OptiFine yolu "Default" ister.
// 1.21.9+ ve 26.x: pack.mcmeta min_format/max_format zorunlu; Modrinth paketleri
// eski pack_format + supported_formats ile gelince oyun baÃƒâ€¦Ã…Â¸langÃƒâ€Ã‚Â±ÃƒÆ’Ã‚Â§ta paketi siliyor.
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
  // 1.21.9+ oyunlarÃƒâ€Ã‚Â± geniÃƒâ€¦Ã…Â¸ min/max aralÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nÃƒâ€Ã‚Â± (ÃƒÆ’Ã‚Â¶r. 55ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“84) reddedip options.txt'ten
  // silebiliyor; hedef sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mle birebir eÃƒâ€¦Ã…Â¸leÃƒâ€¦Ã…Â¸me gerekir.
  return (
    min === format &&
    max === format &&
    pack.pack_format == null &&
    pack.supported_formats == null
  );
}

// 1.21.9 Ã¶ncesi oyunlar pack.mcmeta'da pack_format ister; yoksa paketi hiÃ§ yÃ¼klemez
// ("Couldn't load pack metadata"). AynÄ± zip Ã¶nce 26.x iÃ§in min/max_format'a
// yamalanÄ±p sonra eski bir sÃ¼rÃ¼mde aÃ§Ä±lÄ±nca bu olur â€” geri yamalamak gerekir.
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
    // Paketin kendi pack_format'Ä± varsa dokunma (orijinal Modrinth paketi).
    if (typeof pack.pack_format === 'number') return false;
    meta.pack = { description, pack_format: format };
  }

  // adm-zip writeZip() mevcut arÃƒâ€¦Ã…Â¸ivi yerinde gÃƒÆ’Ã‚Â¼ncellerken bazÃƒâ€Ã‚Â± paketleri (3D crops vb.)
  // bozabiliyor; ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±kar ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ pack.mcmeta yaz ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ yeniden zip'le akÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â± gÃƒÆ’Ã‚Â¼venli.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-rp-'));
  const tmpOut = `${zipPath}.marsana-patch.tmp`;
  try {
    // Kaynak paketi Modrinth'ten indirilmiÃƒâ€¦Ã…Â¸ uzak bir zip; girdi adlarÃƒâ€Ã‚Â± gÃƒÆ’Ã‚Â¼venilmez.
    // adm-zip'in extractAllTo'su yerine kendi kapsama kontrolÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼z kullanÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±r.
    // GÃƒÆ’Ã‚Â¼vensiz bir girdi ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±karsa hata fÃƒâ€Ã‚Â±rlar, aÃƒâ€¦Ã…Â¸aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±daki catch paketi olduÃƒâ€Ã…Â¸u gibi
    // bÃƒâ€Ã‚Â±rakÃƒâ€Ã‚Â±r (yama uygulanmaz) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â bozuk paket yerine yamasÃƒâ€Ã‚Â±z paket tercih edilir.
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
    if (isKnown || /Ãƒâ€šÃ‚Â§|ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§/.test(entry)) {
      removeIfExists(path.join(shaderpacksDir, entry));
    }
  }
}

function isCorruptShaderPackName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  return /Ãƒâ€šÃ‚Â§|ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§|\u00C2\u00A7|\\u00C2\\u00A7|LexBoosT/i.test(s);
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
    // OptiFine paketi kendi optimizasyon modlarÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± getirir; ikisi birlikte ÃƒÆ’Ã‚Â§ift jar ÃƒÆ’Ã‚Â¼retir.
    // KullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±n "Mod ekle" ile eklediÃƒâ€Ã…Â¸i, bu seÃƒÆ’Ã‚Â§imde yÃƒÆ’Ã‚Â¼klenecek mod var.
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

// YalnÃƒâ€Ã‚Â±zca ÃƒÆ’Ã‚Â¶n sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ gÃƒÆ’Ã‚Â¼ncel olan modlar: Steam 'n' Rails 1.21.1 portunun son "release"i
// (0.2.1) eski kalÃƒâ€Ã‚Â±yor, gÃƒÆ’Ã‚Â¼ncel iÃƒÆ’Ã‚Â§erik beta kanalÃƒâ€Ã‚Â±nda yayÃƒâ€Ã‚Â±nlanÃƒâ€Ã‚Â±yor.
const PRERELEASE_MOD_SLUGS = new Set(['create-steam-n-rails-1.21.1']);

const OPTIONAL_LOADER_MOD_SLUGS = new Set([POLYTONE_SLUG, ...CLIENT_HUD_MOD_SLUGS]);

function usesStrictModrinthPatch(gameVersion) {
  const id = String(gameVersion || '').trim();
  return /^\d+\.\d+\.\d+$/.test(id) && !/^26\./.test(id);
}

function polytoneSupportedForGameVersion(gameVersion) {
  // Polytone Modrinth'te en fazla 1.21.11'e kadar; 26.x iÃƒÆ’Ã‚Â§in native jar yok.
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
  // Better Leaves kaynak paketi tek baÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±na yetmez; Cull Leaves (veya OptiFine Smart Leaves) gerekir.
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

// OptiFine modpack'i Continuity gibi opsiyonel modlarÃƒâ€Ã‚Â± `*.jar.disabled` olarak
// getiriyor. KullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â± "kabartma" preset'ini de seÃƒÆ’Ã‚Â§tiyse bu modlarÃƒâ€Ã‚Â± etkinleÃƒâ€¦Ã…Â¸tir.
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

/** OptiFine paketinde rrls vb. ile cakisan modlar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kaldirilir, yeniden indirilmez. */
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

// Continuity'nin yan-yana baÃƒâ€Ã…Â¸lÃƒâ€Ã‚Â± doku (CTM) etkisi ancak built-in resource
// pack'leri Minecraft'Ãƒâ€Ã‚Â±n `options.txt` `resourcePacks` listesinde yer aldÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nda
// gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼r. Mod yokken Minecraft bu paketleri otomatik kaldÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±yor, mod tekrar
// yÃƒÆ’Ã‚Â¼klendiÃƒâ€Ã…Â¸inde geri eklemiyor.
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
  // Round Trees diÃƒâ€Ã…Â¸er paketlerin ÃƒÆ’Ã‚Â¼stÃƒÆ’Ã‚Â¼nde olmalÃƒâ€Ã‚Â± (Modrinth ÃƒÆ’Ã‚Â¶nerisi).
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
    // Eski bundle'larda alan yok; yok = kapalÃƒâ€Ã‚Â±.
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
        /* OptiFine paketindeki yardimci mod bu surumde yoksa atla ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kirli jar zaten silindi */
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
    status('Zoom (C) iÃƒÆ’Ã‚Â§in Zoomify kuruluyor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â resmi OptiFine 26.x henÃƒÆ’Ã‚Â¼z yok.');
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
      (existing.shaderpacks || []).some((name) => /Ãƒâ€šÃ‚Â§/.test(String(name))) ||
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

  // MCLC, Minecraft 1.21+'in numerik asset index ID'sini (ÃƒÆ’Ã‚Â¶rn. "30") gameVersion
  // adÃƒâ€Ã‚Â±yla kaydedebiliyor; sonuÃƒÆ’Ã‚Â§ olarak oyun aradÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â± `<id>.json`'u bulamayÃƒâ€Ã‚Â±p
  // panorama, diller ve sesleri yÃƒÆ’Ã‚Â¼kleyemiyor. Eksikse Mojang'dan indirip
  // doÃƒâ€Ã…Â¸ru isimle yerleÃƒâ€¦Ã…Â¸tir.
  async function ensureAssetIndexFile({ gameRoot, assetIndex }) {
    if (!assetIndex || !assetIndex.id || !assetIndex.url) return;
    const indexesDir = path.join(gameRoot, 'assets', 'indexes');
    await fs.promises.mkdir(indexesDir, { recursive: true });
    // assetIndex.id uzak Mojang JSON'undan geliyor; dosya adÃƒâ€Ã‚Â±na doÃƒâ€Ã…Â¸rudan gÃƒÆ’Ã‚Â¶mÃƒÆ’Ã‚Â¼lÃƒÆ’Ã‚Â¼yor.
    const targetPath = assertInside(
      indexesDir,
      `${assetIndex.id}.json`,
      `Asset index adÃƒâ€Ã‚Â± gÃƒÆ’Ã‚Â¼venli deÃƒâ€Ã…Â¸il: "${assetIndex.id}".`
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

  // Mojang'Ãƒâ€Ã‚Â±n base sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mleri (1.20, 1.21, 1.19) iÃƒÆ’Ã‚Â§in mod ekosistemi genelde
  // patch sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼ (1.20.1, 1.21.1, ...) hedefler ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â base'ten ilk patch'e mod
  // gÃƒÆ’Ã‚Â¼ncellemesi gelir. Anchor sorgusunu expand edersek Modrinth daha gÃƒÆ’Ã‚Â¼ncel ve
  // birbiriyle uyumlu sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mleri dÃƒÆ’Ã‚Â¶ner.
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

  // Modlar arasÃƒâ€Ã‚Â± "latest" sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mler bazen birbiriyle uyumsuz olabilir (ÃƒÆ’Ã‚Â¶rn. Iris
  // 1.6.11 Modrinth manifest'inde Sodium 0.5.7'yi gÃƒÆ’Ã‚Â¶sterir ama jar iÃƒÆ’Ã‚Â§indeki
  // breaks Sodium >=0.5.7'yi ÃƒÆ’Ã‚Â§akÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸malÃƒâ€Ã‚Â± sayar). ÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã‚Â¶zÃƒÆ’Ã‚Â¼m katmanlarÃƒâ€Ã‚Â±:
  //  - gameVersion'Ãƒâ€Ã‚Â± patch ile expand et ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â yeni anchor'lar gelir.
  //  - Anchor mod (Iris/Continuity) ÃƒÆ’Ã‚Â¶nce ÃƒÆ’Ã‚Â§ek.
  //  - Anchor'Ãƒâ€Ã‚Â±n Modrinth `dependencies` listesindeki spesifik `version_id`'leri
  //    indir; null ise anchor'Ãƒâ€Ã‚Â±n yayÃƒâ€Ã‚Â±n tarihinden ÃƒÆ’Ã‚Â¶nceki en son uyumlu sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼
  //    al (contemporary heuristic).
  //  - AynÃƒâ€Ã‚Â± projenin tekrar indirilmesini engellemek iÃƒÆ’Ã‚Â§in downloaded set tutulur.
  // skipExisting: diskte aynÃƒâ€Ã‚Â± boyutta jar varsa yeniden indirme (her aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta ~50 MB'lÃƒâ€Ã‚Â±k
  // paketi ÃƒÆ’Ã‚Â§ekmemek iÃƒÆ’Ã‚Â§in). optionalSlugs: bu slug'lar iÃƒÆ’Ã‚Â§in uygun sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m yoksa atla.
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
      // file.filename Modrinth'ten geliyor; yol bileÃƒâ€¦Ã…Â¸eni iÃƒÆ’Ã‚Â§erebilir. mrpackInstaller
      // aynÃƒâ€Ã‚Â± alanda path.basename uyguluyor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â burada da modsDir dÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±na ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±kÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â± engelle.
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
            `Modrinth: "${slug}" iÃƒÆ’Ã‚Â§in uygun sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m bulunamadÃƒâ€Ã‚Â±.`
          );
        }
      } catch (err) {
        if (OPTIONAL_LOADER_MOD_SLUGS.has(slug) || (optionalSlugs && optionalSlugs.has(slug))) continue;
        if (err && err.code === Codes.MODRINTH_NOT_FOUND) {
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Bu Minecraft sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ (${gameVersion}) iÃƒÆ’Ã‚Â§in "${slug}" modunun ${loaderFilter.join('/')} uyumlu sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ Modrinth'te yok. ` +
              'Snapshot/henÃƒÆ’Ã‚Â¼z yayÃƒâ€Ã‚Â±nlanmamÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mlerde bu modlar olmaz ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â stable bir release (ÃƒÆ’Ã‚Â¶rn. 1.21.4, 1.20.1) seÃƒÆ’Ã‚Â§in.'
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
          onNotice(`Shader paketi hazÃƒâ€Ã‚Â±r: ${safeName}`);
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
          `"${slug}" bu Minecraft sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nde bulunamadÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Complementary Reimagined kullanÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±yor.`
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

  // Iris shader paketi otomatik aktivasyonu: indirilen pack zaten varsa kullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±n
  // Options ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Video ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Shader Packs menÃƒÆ’Ã‚Â¼sÃƒÆ’Ã‚Â¼ne girip seÃƒÆ’Ã‚Â§mesi gerekmesin. Iris ilk aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta
  // boÃƒâ€¦Ã…Â¸ bir `shaderPack=` yazÃƒâ€Ã‚Â±yor; mevcut satÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â± (varsa) gÃƒÆ’Ã‚Â¼ncelle, yoksa ekle.
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

  // Oculus (Iris'in Forge/NeoForge fork'u) kendi config dosyasÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± kullanÃƒâ€Ã‚Â±r:
  // `config/oculus.properties`. Format Iris ile aynÃƒâ€Ã‚Â±.
  function activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'oculus.properties'), shaderpackFilename);
  }

  // OptiFine'Ãƒâ€Ã‚Â±n shader config dosyasÃƒâ€Ã‚Â± ayrÃƒâ€Ã‚Â±: `optionsshaders.txt`. Format ana
  // options.txt'e benzer ama OptiFine bunu shader pack seÃƒÆ’Ã‚Â§imi iÃƒÆ’Ã‚Â§in okur.
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

  // Forge / NeoForge iÃƒÆ’Ã‚Â§in launch ÃƒÆ’Ã‚Â¶ncesi eski shader mod jar'larÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± temizle.
  // AynÃƒâ€Ã‚Â± kategoride iki sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m (ÃƒÆ’Ã‚Â¶rn. Rubidium + Embeddium ya da Oculus + Iris)
  // duplicate hatasÃƒâ€Ã‚Â± verir ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sÃƒâ€Ã‚Â±fÃƒâ€Ã‚Â±rdan kuruyoruz ki tutarlÃƒâ€Ã‚Â± kombinasyon olsun.
  //
  // ÃƒÆ’Ã¢â‚¬â€œNEMLÃƒâ€Ã‚Â°: hem aktif `.jar` hem stash kopyalarÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± siliyoruz. Aksi halde
  // applyLoaderModsState bir sonraki loader geÃƒÆ’Ã‚Â§iÃƒâ€¦Ã…Â¸inde eski stash'i restore
  // edip eski Rubidium'u geri getirir ve yeni Embeddium ile ÃƒÆ’Ã‚Â§akÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±r.
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

  // Forge ailesinde kabartma iÃƒÆ’Ã‚Â§in yÃƒÆ’Ã‚Â¶netilen jar'lar: Continuity (Forge/NeoForge).
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

    // Eski shader mod kombinasyonlarÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± temizle ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â duplicate riskini ÃƒÆ’Ã‚Â¶nler.
    if (loader === 'forge' || loader === 'neoforge') {
      cleanupForgeFamilyShaderJars(modsDir);
    }

    if (loader === 'forge-optifine') {
      status('Shader paketi indiriliyor (OptiFine iÃƒÆ’Ã‚Â§in)...');
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

    // Anchor mod yeterli ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Modrinth'in `dependencies` listesi Sodium/Embeddium
    // gibi gerekli baÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±mlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±klarÃƒâ€Ã‚Â± zaten getiriyor. Ek slug yazarsak bir
    // projenin iki sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼ (ÃƒÆ’Ã‚Â¶rn. Rubidium + Embeddium) yan yana indirebiliriz
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

    status(`Shader modlarÃƒâ€Ã‚Â± indiriliyor (${loader})...`);
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
      loaders: ['iris'], // Oculus de Iris API'sini kullanÃƒâ€Ã‚Â±r, aynÃƒâ€Ã‚Â± paket
      shaderSlug,
      onNotice: status,
    });
    if (packs[0]) {
      if (loader === 'forge') {
        // Oculus kendi config dosyasÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± okur (oculus.properties), iris.properties deÃƒâ€Ã…Â¸il.
        activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename: packs[0] });
      } else {
        // NeoForge ve Quilt: gerÃƒÆ’Ã‚Â§ek Iris mod'u ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ iris.properties
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
        `${label} bu Minecraft sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ (${gameVersion}) iÃƒÆ’Ã‚Â§in Modrinth'te bulunamadÃƒâ€Ã‚Â±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, `${label} dosyasÃƒâ€Ã‚Â± Modrinth'te bulunamadÃƒâ€Ã‚Â±.`);
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, localName), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({ resourcepacksDir, localName, gameVersion });
    const versionLabel = picked.name || picked.version_number || label;
    if (onNotice) onNotice(`${label} ${versionLabel} hazÃƒâ€Ã‚Â±r: ${localName}`);
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
        `New Glowing Ores bu Minecraft sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ (${gameVersion}) iÃƒÆ’Ã‚Â§in Modrinth'te bulunamadÃƒâ€Ã‚Â±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'New Glowing Ores dosyasÃƒâ€Ã‚Â± Modrinth\'te bulunamadÃƒâ€Ã‚Â±.');
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
    if (onNotice) onNotice(`New Glowing Ores ${variantLabel} hazÃƒâ€Ã‚Â±r: ${GLOWING_ORES_PACK_LOCAL_NAME}`);
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
        `Fullbright UB bu Minecraft sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ (${gameVersion}) iÃƒÆ’Ã‚Â§in Modrinth/CurseForge'ta bulunamadÃƒâ€Ã‚Â±.`
      );
    }

    const file = modrinthClient.primaryFileOf(picked);
    if (!file || !file.url) {
      throw new LauncherError(Codes.MODRINTH_NOT_FOUND, 'Fullbright UB dosyasÃƒâ€Ã‚Â± Modrinth\'te bulunamadÃƒâ€Ã‚Â±.');
    }

    await fs.promises.mkdir(resourcepacksDir, { recursive: true });
    await httpClient.download(file.url, path.join(resourcepacksDir, FULLBRIGHT_PACK_LOCAL_NAME), modrinthClient.fileIntegrity(file));
    ensureResourcePackCompatibleForGame({
      resourcepacksDir,
      localName: FULLBRIGHT_PACK_LOCAL_NAME,
      gameVersion,
    });

    const label = picked.name || picked.version_number || 'Fullbright UB';
    if (onNotice) onNotice(`Fullbright UB ${label} hazÃƒâ€Ã‚Â±r: ${FULLBRIGHT_PACK_LOCAL_NAME}`);
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
      status('Fullbright + Shader iÃƒÆ’Ã‚Â§in PolyTone indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [POLYTONE_SLUG],
          modrinthLoaders: [loader],
        });
      } catch {
        status('PolyTone bulunamadÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Fullbright Sodium/Iris ile ÃƒÆ’Ã‚Â§alÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸mayabilir.');
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
      status('Better Leaves iÃƒÆ’Ã‚Â§in Cull Leaves indiriliyor (Sodium/Embeddium baÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±mlÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±klarÃƒâ€Ã‚Â± otomatik)...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CULL_LEAVES_SLUG],
          modrinthLoaders: [modLoader],
        });
      } catch {
        status('Cull Leaves bulunamadÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â OptiFine Smart Leaves veya Fabric yÃƒÆ’Ã‚Â¼kleyici deneyin.');
      }
    } else if (loader === 'vanilla') {
      status(
        "Better Leaves: Vanilla'da tam etki iÃƒÆ’Ã‚Â§in Fabric + Cull Leaves veya Forge/OptiFine + Smart Leaves kullanÃƒâ€Ã‚Â±n."
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
      status('Glowing Ores: NeoForge\'da Continuity + Connector gerekir ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â maden parÃƒâ€Ã‚Â±ltÃƒâ€Ã‚Â±sÃƒâ€Ã‚Â± gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nmeyebilir.');
    } else if (willInstallContinuity) {
      status('Glowing Ores iÃƒÆ’Ã‚Â§in Continuity indiriliyor...');
      try {
        await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: [CONTINUITY_SLUG],
          modrinthLoaders: [modLoader],
        });
        ensureContinuityResourcePacks(gameRoot);
      } catch {
        status('Continuity bulunamadÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â OptiFine Emissive Textures veya KabartmalÃƒâ€Ã‚Â± bloklar (Continuity) gerekir.');
      }
    } else if (includeOptifine) {
      status('Glowing Ores (Default): OptiFine\'da Video AyarlarÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Kalite ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Emissive Textures aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±n.');
    } else if (loader === 'vanilla') {
      status('Glowing Ores (Default): Vanilla\'da parÃƒâ€Ã‚Â±ltÃƒâ€Ã‚Â± iÃƒÆ’Ã‚Â§in Fabric+Continuity veya Forge+OptiFine kullanÃƒâ€Ã‚Â±n.');
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

  // Launcher'Ãƒâ€Ã‚Â±n kurduÃƒâ€Ã…Â¸u Create jar'larÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± (loader geÃƒÆ’Ã‚Â§iÃƒâ€¦Ã…Â¸inde stash'lenmiÃƒâ€¦Ã…Â¸ kopyalarÃƒâ€Ã‚Â±
  // dahil) siler. `keep` listesindeki adlarÃƒâ€Ã‚Â±n etkin kopyasÃƒâ€Ã‚Â± korunur.
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

  // Flywheel: compute-shader tabanlÃƒâ€Ã‚Â± "indirect" backend ve SMOOTH Ãƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±k, entegre GPU'da
  // pahalÃƒâ€Ã‚Â±. Dosya ilk oyun aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±nda oluÃƒâ€¦Ã…Â¸ur; yoksa sonraki aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta denenir.
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

  // Her aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta: render/simÃƒÆ’Ã‚Â¼lasyon mesafesi ÃƒÆ’Ã‚Â¼st sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â± aÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±yorsa dÃƒÆ’Ã‚Â¼Ãƒâ€¦Ã…Â¸ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼r (altÃƒâ€Ã‚Â±ndakilere dokunmaz).
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

  // options.txt'te ÃƒÆ’Ã‚Â¼st sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â± aÃƒâ€¦Ã…Â¸an deÃƒâ€Ã…Â¸erleri dÃƒÆ’Ã‚Â¼Ãƒâ€¦Ã…Â¸ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼r; sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±n altÃƒâ€Ã‚Â±ndakilere dokunmaz.
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

  // HazÃƒâ€Ã‚Â±r paketlerin video ayarÃƒâ€Ã‚Â±: render mesafesi 12'ye ayarlanÃƒâ€Ã‚Â±r, aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±r ayarlar sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rlanÃƒâ€Ã‚Â±r.
  // Paket baÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±na bir kez uygulanÃƒâ€Ã‚Â±r; paket kapatÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±nca iÃƒâ€¦Ã…Â¸aret silinir, yeniden seÃƒÆ’Ã‚Â§ilince tekrar uygulanÃƒâ€Ã‚Â±r.
  function syncFpsBoostVideoOptions({ gameRoot, modsDir, enabled, unlimited, status }) {
    const markerPath = path.join(modsDir, FPS_BOOST_MARKER_FILE);
    const optionsPath = path.join(gameRoot, 'options.txt');
    let marker = null;
    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    } catch {
      /* iÃƒâ€¦Ã…Â¸aret yok ya da bozuk */
    }
    let text = '';
    try {
      text = fs.readFileSync(optionsPath, 'utf8');
    } catch {
      /* ilk kurulum: options.txt henÃƒÆ’Ã‚Â¼z yok */
    }
    if (!enabled) {
      if (!marker) return;
      // YalnÃƒâ€Ã‚Â±zca paketin yazdÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â± deÃƒâ€Ã…Â¸er hÃƒÆ’Ã‚Â¢lÃƒÆ’Ã‚Â¢ duruyorsa geri al; kullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â± oyun iÃƒÆ’Ã‚Â§inden deÃƒâ€Ã…Â¸iÃƒâ€¦Ã…Â¸tirdiyse dokunma.
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

    // "ÃƒÆ’Ã¢â‚¬â€œnceki deÃƒâ€Ã…Â¸er" yalnÃƒâ€Ã‚Â±zca paket ilk uygulandÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±nda dosyadan okunur; paketler arasÃƒâ€Ã‚Â± geÃƒÆ’Ã‚Â§iÃƒâ€¦Ã…Â¸te
    // dosyadaki deÃƒâ€Ã…Â¸er ÃƒÆ’Ã‚Â¶teki paketin yazdÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±dÃƒâ€Ã‚Â±r, eski iÃƒâ€¦Ã…Â¸aretteki korunur.
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
    status('Paket: render mesafesi ' + FPS_BOOST_RENDER_DISTANCE + ' chunk yapÃƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±, ' + (unlimited ? 'FPS sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â± kaldÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±' : 'FPS sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â± 120 yapÃƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±') + ', aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±r video ayarlarÃƒâ€Ã‚Â± dÃƒÆ’Ã‚Â¼Ãƒâ€¦Ã…Â¸ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼ldÃƒÆ’Ã‚Â¼ (oyun iÃƒÆ’Ã‚Â§inden deÃƒâ€Ã…Â¸iÃƒâ€¦Ã…Â¸tirilebilir).');
  }

  function releaseFpsBoostVideoOptions(gameRoot) {
    syncFpsBoostVideoOptions({ gameRoot, modsDir: path.join(gameRoot, 'mods'), enabled: false });
  }

  // Create + kÃƒÆ’Ã‚Â¼ratÃƒÆ’Ã‚Â¶rlÃƒÆ’Ã‚Â¼ eklenti listesi (CREATE_ADDON_SLUGS). ArayÃƒÆ’Ã‚Â¼z bu seÃƒÆ’Ã‚Â§eneÃƒâ€Ã…Â¸i NeoForge
  // 1.21.1'e sabitler. GÃƒÆ’Ã‚Â¼ncel jar'lar yeniden indirilmez; Modrinth'e ulaÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±lamazsa kurulu
  // jar'larla devam edilir (tek oyunculu, ÃƒÆ’Ã‚Â§evrimdÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â± aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸). Taban Create bulunamazsa
  // hata verilir; bir eklentinin uygun sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ yoksa o eklenti sessizce atlanÃƒâ€Ã‚Â±r.
  //
  // `serverPack`: Klima SMP paketi ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Create ve eklentileri sunucuyla aynÃƒâ€Ã‚Â±
  // sabit sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mden kurulur (NeoForge kayÃƒâ€Ã‚Â±t eÃƒâ€¦Ã…Â¸leÃƒâ€¦Ã…Â¸mesi), yalnÃƒâ€Ã‚Â±zca FPS modlarÃƒâ€Ã‚Â± gÃƒÆ’Ã‚Â¼ncel ÃƒÆ’Ã‚Â§ekilir.
  async function installCreateForExternalLoader({ loader, gameRoot, gameVersion, emit, serverPack = false }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);
    const previous = readManagedCreateJars(modsDir);
    // Sunucu paketinde ÃƒÆ’Ã‚Â§evrimdÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â± yedek yalnÃƒâ€Ã‚Â±zca sabit jar'lar zaten kuruluysa kullanÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±r:
    // normal Create paketinin eklentileriyle sunucuya baÃƒâ€Ã…Â¸lanÃƒâ€Ã‚Â±lamaz.
    const previousOnDisk =
      previous.length > 0 &&
      previous.every((j) => fs.existsSync(path.join(modsDir, j))) &&
      (!serverPack || MARSANA_SERVER_PINNED_MODS.every((m) => previous.includes(m.file)));

    status(serverPack ? 'Klima SMP paketi hazÃƒâ€Ã‚Â±rlanÃƒâ€Ã‚Â±yor...' : 'Create ve eklentileri hazÃƒâ€Ã‚Â±rlanÃƒâ€Ã‚Â±yor...');
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
        // Launcher'la gelen eklentiler; taban Create kurulduysa eklenir, jar eksikse atlanÃƒâ€Ã‚Â±r.
        if (jars.length > 0) {
          for (const addon of CREATE_BUNDLED_ADDONS) {
            try {
              const [jar] = await downloadPinnedMods(modsDir, [addon]);
              if (!jars.includes(jar)) jars.push(jar);
            } catch (err) {
              status('Create: ' + addon.file + ' atlandÃƒâ€Ã‚Â± (' + err.message + ').');
            }
          }
        }
      }
    } catch (err) {
      if (previousOnDisk) {
        status("Create: Modrinth'e ulaÃƒâ€¦Ã…Â¸Ãƒâ€Ã‚Â±lamadÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kurulu sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mlerle devam ediliyor.");
        return { jars: previous };
      }
      throw err;
    }

    if (jars.length === 0) {
      throw new LauncherError(
        Codes.MODRINTH_NOT_FOUND,
        `Create modunun ${loader} ${gameVersion} uyumlu sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼ Modrinth'te bulunamadÃƒâ€Ã‚Â±.`
      );
    }
    if (capCreateDistances(gameRoot)) {
      status('Create: render mesafesi en fazla ' + CREATE_RENDER_DISTANCE_MAX + ', simÃƒÆ’Ã‚Â¼lasyon mesafesi en fazla ' + CREATE_SIMULATION_DISTANCE_MAX + ' (takÃƒâ€Ã‚Â±lmayÃƒâ€Ã‚Â± ÃƒÆ’Ã‚Â¶nler).');
    }
    const marker = readCreateMarker(modsDir);
    let tuned = marker.tuned;
    let flywheelTuned = marker.flywheelTuned;
    if (!flywheelTuned) {
      const r = tuneFlywheelConfig(gameRoot);
      if (r !== null) {
        flywheelTuned = true;
        if (r) status('Create: Flywheel hafif moda alÃƒâ€Ã‚Â±ndÃƒâ€Ã‚Â± (entegre ekran kartÃƒâ€Ã‚Â± iÃƒÆ’Ã‚Â§in).');
      }
    }
    if (!tuned) {
      if (capCreateVideoOptions(gameRoot)) {
        status('Create: render mesafesi ve benzeri aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±r video ayarlarÃƒâ€Ã‚Â± FPS iÃƒÆ’Ã‚Â§in dÃƒÆ’Ã‚Â¼Ãƒâ€¦Ã…Â¸ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼ldÃƒÆ’Ã‚Â¼ (oyun iÃƒÆ’Ã‚Â§inden deÃƒâ€Ã…Â¸iÃƒâ€¦Ã…Â¸tirilebilir).');
      }
      tuned = true;
    }
    // Listeden ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±kan / gÃƒÆ’Ã‚Â¼ncellenen eski jar'larÃƒâ€Ã‚Â± sil, marker'Ãƒâ€Ã‚Â± tÃƒÆ’Ã‚Â¼m yeni jar'larla yaz.
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

  // Sabit sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mlÃƒÆ’Ã‚Â¼ jar'larÃƒâ€Ã‚Â± indirir; diskte aynÃƒâ€Ã‚Â± hash'le duranlar yeniden indirilmez.
  async function downloadPinnedMods(modsDir, mods) {
    await fs.promises.mkdir(modsDir, { recursive: true });
    const jars = [];
    for (const mod of mods) {
      const safeName = path.basename(String(mod.file || ''));
      const destPath = assertInside(modsDir, safeName);
      if (sha512OfFile(destPath) !== mod.sha512) {
        if (mod.bundled) {
          // Modrinth'te olmayan (ÃƒÆ’Ã‚Â¶r. incelemede) mod: launcher'la gelen jar kopyalanÃƒâ€Ã‚Â±r.
          const src = repoRoot ? path.join(repoRoot, 'bundled-mods', mod.bundled) : null;
          if (!src || sha512OfFile(src) !== mod.sha512) {
            throw new LauncherError(
              Codes.MODRINTH_NOT_FOUND,
              `Klima SMP modu launcher iÃƒÆ’Ã‚Â§inde bulunamadÃƒâ€Ã‚Â±: ${safeName}`
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

  // Forge ailesi loader'lar iÃƒÆ’Ã‚Â§in kabartmalÃƒâ€Ã‚Â± blok (CTM) modunu yÃƒÆ’Ã‚Â¼kle.
  //   'forge'           ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Continuity Forge (sadece 1.20.1; Modrinth'te tek sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m)
  //   'neoforge'        ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Continuity NeoForge (sadece 1.21.1; tek sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m)
  //   'forge-optifine'  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ no-op (OptiFine kendi iÃƒÆ’Ã‚Â§inde CTM destekler)
  async function installEmbossedForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);

    if (loader === 'forge-optifine') {
      status('Kabartma: OptiFine kendi iÃƒÆ’Ã‚Â§inde baÃƒâ€Ã…Â¸lÃƒâ€Ã‚Â± doku desteÃƒâ€Ã…Â¸i saÃƒâ€Ã…Â¸lÃƒâ€Ã‚Â±yor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ek mod indirilmedi.');
      return { jars: [] };
    }
    if (loader === 'neoforge') {
      // NeoForge'da Continuity native deÃƒâ€Ã…Â¸il ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sadece Sinytra Connector ile
      // ÃƒÆ’Ã‚Â§alÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸an Fabric jar'Ãƒâ€Ã‚Â± ve bu kombinasyon NeoForge 21.1.x ile
      // ClassCastException (ModFileParser$MixinConfig) atÃƒâ€Ã‚Â±yor. Indirmeyi
      // atla, kullanÃƒâ€Ã‚Â±cÃƒâ€Ã‚Â±yÃƒâ€Ã‚Â± bilgilendir.
      status('Kabartma: NeoForge bu sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mde Continuity\'yi native desteklemiyor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â atlandÃƒâ€Ã‚Â±.');
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

    // options.txt'e Continuity resource pack'lerini ekle ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Continuity 3.0+ kendi
    // built-in resource pack'lerini sunar ama Minecraft options'ta listelenmek
    // zorundadÃƒâ€Ã‚Â±r, aksi takdirde CTM gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nmez.
    ensureContinuityResourcePacks(gameRoot);

    return { jars };
  }

  async function ensure({ gameRoot, gameVersion, emit, modPresets, shaderSlug, fabricChannel = 'stable', playMode }) {
    const presets = normalizePresets(modPresets);
    if (!presets.shaderFps && !presets.embossedBlocks && !presets.optifine && !presets.voiceChat && !presets.fullbrightUb && !presets.betterLeaves && !presets.glowingOres && !presets.roundTrees && !presets.crops3d && !presets.schematicFarm && !presets.clientHudPack && !presets.marsanaClientMenu && !presets.sodium && !presets.sodiumExtra && !presets.userMods) {
      throw new Error('shaderStackService.ensure: en az bir mod ÃƒÆ’Ã‚Â¶nayarÃƒâ€Ã‚Â± gerekli');
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
      status(`Mod profili (ÃƒÆ’Ã‚Â¶nbellek): ${resolvedShaderSlug} shader hazÃƒâ€Ã‚Â±r, baÃƒâ€¦Ã…Â¸latÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±yor...`);
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

    status(`Mod profili: Fabric yÃƒÆ’Ã‚Â¼kleyici eÃƒâ€¦Ã…Â¸leÃƒâ€¦Ã…Â¸tiriliyor (${gameVersion})...`);
    const { merged, loaderVersion } = await installFabricProfile({
      gameVersion,
      customId,
      versionDir,
      versionJsonPath,
      fabricChannel,
    });
    await ensureAssetIndexFile({ gameRoot, assetIndex: merged.assetIndex });

    status('Mod profili: seÃƒÆ’Ã‚Â§ilen modlar indiriliyor...');
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
      status('Paket: FPS optimizasyon modlarÃƒâ€Ã‚Â± indiriliyor (uyumlu olanlar)...');
      try {
        fpsBoostJars = await downloadModsFromSlugs({
          modsDir,
          gameVersion,
          slugs: FPS_BOOST_SLUGS,
          optionalSlugs: new Set(FPS_BOOST_SLUGS),
        });
      } catch {
        status('Paket: bazÃƒâ€Ã‚Â± FPS modlarÃƒâ€Ã‚Â± indirilemedi ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kalan modlarla devam ediliyor.');
      }
    }
    modCompatibilityService.purgeIncompatibleModJars(modsDir, gameVersion);
    jars = await ensureShaderCoreMods({ modsDir, gameVersion, presets, status, jars });
    // Uyumsuz ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±kÃƒâ€Ã‚Â±p temizlenen FPS modu bundle'a yazÃƒâ€Ã‚Â±lmamalÃƒâ€Ã‚Â±; yoksa ÃƒÆ’Ã‚Â¶nbellek her aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±lÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ta geÃƒÆ’Ã‚Â§ersiz olur.
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
        ? ' Resmi OptiFine.jar 26.x\'te henÃƒÆ’Ã‚Â¼z yok; zoom iÃƒÆ’Ã‚Â§in Zoomify (C) eklendi.'
        : '';
      status(
        `${packLabel} kuruldu.${mc26Note} Video ayarlarÃƒâ€Ã‚Â± ve shader seÃƒÆ’Ã‚Â§enekleri paket iÃƒÆ’Ã‚Â§indeki modlarla gelir; ` +
          'Shader + FPS seÃƒÆ’Ã‚Â§eneÃƒâ€Ã…Â¸iyle birlikte kullanmayÃƒâ€Ã‚Â±n.'
      );
    } else if (presets.shaderFps && presets.embossedBlocks) {
      status(
        'Mod profili hazÃƒâ€Ã‚Â±r. Shader: SeÃƒÆ’Ã‚Â§enekler ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Video ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Shader Packs (ComplementaryÃƒÂ¢Ã¢â€šÂ¬Ã¢â€Â¢de Performance ÃƒÆ’Ã‚Â¶nerilir). ' +
          'Kabartma: Continuity + Sodium.'
      );
    } else if (presets.shaderFps) {
      status(
        'Shader + FPS profili hazÃƒâ€Ã‚Â±r. Oyun iÃƒÆ’Ã‚Â§inde: SeÃƒÆ’Ã‚Â§enekler ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Video ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Shader Packs; ComplementaryÃƒÂ¢Ã¢â€šÂ¬Ã¢â€Â¢de Performance profili ÃƒÆ’Ã‚Â¶nerilir.'
      );
    } else if (presets.voiceChat) {
      status(
        'Simple Voice Chat kuruldu. Oyunda V tuÃƒâ€¦Ã…Â¸una basarak veya ayarlardan mikrofonu yapÃƒâ€Ã‚Â±landÃƒâ€Ã‚Â±rÃƒâ€Ã‚Â±n; sunucuda da mod gerekir.'
      );
    } else if (presets.fullbrightUb) {
      status(
        fullbrightNeedsPolytone(presets, gameVersion)
          ? 'Fullbright UB kuruldu. Kaynak paketi etkinleÃƒâ€¦Ã…Â¸tirildi; Sodium/Iris ile PolyTone da yÃƒÆ’Ã‚Â¼klendi.'
          : presets.shaderFps && !presets.optifine && !polytoneSupportedForGameVersion(gameVersion)
            ? 'Fullbright UB kuruldu. 26.x sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nde PolyTone henÃƒÆ’Ã‚Â¼z yok ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kaynak paketi etkin; tam parlaklÃƒâ€Ã‚Â±k Sodium/Iris ile sÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â±rlÃƒâ€Ã‚Â± olabilir.'
            : 'Fullbright UB kuruldu. Kaynak paketi indirildi ve SeÃƒÆ’Ã‚Â§enekler ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Kaynak paketleri bÃƒÆ’Ã‚Â¶lÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nde etkinleÃƒâ€¦Ã…Â¸tirildi.'
      );
    } else if (presets.betterLeaves) {
      status(
        betterLeavesNeedsCullLeaves(presets)
          ? presets.optifine
            ? "Motschen's Better Leaves kuruldu. OptiFine ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Video AyarlarÃƒâ€Ã‚Â± ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Kalite ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Smart Leaves aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±n."
            : "Motschen's Better Leaves kuruldu. Kaynak paketi ve Cull Leaves yÃƒÆ’Ã‚Â¼klendi."
          : "Motschen's Better Leaves kuruldu. Kaynak paketi etkinleÃƒâ€¦Ã…Â¸tirildi."
      );
    } else if (presets.glowingOres) {
      const borderPack = glowingOresUseContinuityPack({ presets });
      status(
        borderPack
          ? 'New Glowing Ores (Border) kuruldu. Continuity ile parÃƒâ€Ã‚Â±ltÃƒâ€Ã‚Â± ve baÃƒâ€Ã…Â¸lÃƒâ€Ã‚Â± ÃƒÆ’Ã‚Â§erÃƒÆ’Ã‚Â§eve etkin.'
          : 'New Glowing Ores (Default) kuruldu. OptiFine kullanÃƒâ€Ã‚Â±yorsanÃƒâ€Ã‚Â±z Emissive Textures aÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±n.'
      );
    } else if (presets.roundTrees) {
      status('Round Trees kuruldu. Kaynak paketi listenin en ÃƒÆ’Ã‚Â¼stÃƒÆ’Ã‚Â¼ne yerleÃƒâ€¦Ã…Â¸tirildi.');
    } else if (presets.crops3d) {
      status('3D crops Revamped kuruldu. TarÃƒâ€Ã‚Â±m bloklarÃƒâ€Ã‚Â± 3D gÃƒÆ’Ã‚Â¶rÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼me geÃƒÆ’Ã‚Â§ti.');
    } else if (presets.schematicFarm) {
      status('Sematik Farm modu kuruldu. Oyunda F8 ile farm seÃƒÆ’Ã‚Â§in, Konumu Ayarla ile baÃƒâ€¦Ã…Â¸langÃƒâ€Ã‚Â±ÃƒÆ’Ã‚Â§ noktasÃƒâ€Ã‚Â±nÃƒâ€Ã‚Â± belirleyin.');
    } else {
      status('KabartmalÃƒâ€Ã‚Â± blok / baÃƒâ€Ã…Â¸lÃƒâ€Ã‚Â± doku: Continuity + Sodium hazÃƒâ€Ã‚Â±r.');
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
  // O1/O4 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kritik Modrinth sÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼m-eÃƒâ€¦Ã…Â¸leÃƒâ€¦Ã…Â¸tirme mantÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â± test edilebilsin diye dÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸a
  // aktarÃƒâ€Ã‚Â±lÃƒâ€Ã‚Â±r (davranÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸ DEÃƒâ€Ã‚ÂÃƒâ€Ã‚Â°Ãƒâ€¦Ã‚ÂMEZ; ayrÃƒâ€Ã‚Â±ca ileride ayrÃƒâ€Ã‚Â± modÃƒÆ’Ã‚Â¼le gÃƒÆ’Ã‚Â¼venli ÃƒÆ’Ã‚Â§Ãƒâ€Ã‚Â±karÃƒâ€Ã‚Â±m
  // iÃƒÆ’Ã‚Â§in test gÃƒÆ’Ã‚Â¼venlik aÃƒâ€Ã…Â¸Ãƒâ€Ã‚Â±). Bu fonksiyonlar saf (yan etkisiz).
  resolveShaderSlug,
  extractMcVersionFromModMeta,
  modrinthLoaderModGameVersionCandidates,
  modrinthClassicFallbacksForGameVersion,
  modrinthGameVersionCandidates,
  versionListsAnyGame,
  modrinthCandidateRank,
  pickNewestModrinthVersion,
  glowingOresVariantLabel,
  // OptiFine reconcile slug/jar-test tablolari ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â regresyon testi icin. Slug'lar
  // gercek Modrinth proje slug'lari olmali; yanlis slug (404) reconcile'in bundled
  // bagimliligi silip geri koyamamasina ve oyun cokmesine yol acar.
  OPTIFINE_RECONCILE_SLUGS,
  OPTIFINE_RECONCILE_JAR_TESTS,
};
