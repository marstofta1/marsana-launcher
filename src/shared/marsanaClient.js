/** Marsana Client — tek tıkla hazır mod paketi sabitleri */

export const PLAY_MODES = Object.freeze({
  CLIENT: 'client',
  LAUNCHER: 'launcher',
});

export const DEFAULT_PLAY_MODE = PLAY_MODES.CLIENT;

/**
 * Marsana Client modunun sabit oyun sürümü. Bundled marsana-client mod'u
 * `fabric.mod.json` içinde `minecraft ~26.1.2` gerektirir; bu yüzden HUD overlay
 * (CPS/keystrokes/zoom) + H menüsü YALNIZCA 26.1.2'de yüklenir. Client modu artık
 * kullanıcının seçtiği sürümü değil, her zaman bunu başlatır — aksi halde 1.21.x
 * ya da 26.2 gibi sürümlerde mod sessizce elenip overlay hiç görünmüyordu.
 */
export const MARSANA_CLIENT_VERSION = '26.1.2';

/** Client modunda otomatik uygulanan loader + mod preset'i */
export const CLIENT_MOD_PRESET = Object.freeze({
  selectedLoader: 'fabric',
  selectedShader: 'complementary-reimagined',
  // Client modu shader'i ARTIK zorla acmaz. Kullanici "secmememe ragmen shader
  // aciliyor" dedi; client preset'i her acilista uzerine yaziyordu. Kapali olunca
  // shaderStackService.ensure -> deactivateShaderConfig, eski acik kurulumlari da
  // kapatir. Fullbright + voice chat kasitli olarak acik kaldi ("bunlar normal").
  modShaderFps: false,
  modFullbrightUb: true,
  modVoiceChat: true,
  modOptifine: false,
  modEmbossedBlocks: false,
  modBetterLeaves: false,
  modGlowingOres: false,
  modRoundTrees: false,
  modCrops3d: false,
  modSchematicFarm: true,
  modSodium: true,
  modSodiumExtra: false,
  modClientHudPack: true,
});

/** Client modunda kullanıcıya gösterilen özellik özeti */
export const CLIENT_FEATURES = Object.freeze([
  {
    id: 'schematicFarm',
    title: 'Sematik Farm Modu',
    description: 'F8 — mob, bambu, demir ve seker kamisi farmi; blok ilerlemesi.',
  },
  {
    id: 'clientMenu',
    title: 'Marsana Client Menüsü',
    description: 'Oyunda H tuşu — mod aç/kapa ve ücretsiz kozmetik.',
  },
  {
    id: 'fullbrightUb',
    title: 'Fullbright UB',
    description: 'Karanlıkta tam parlaklık — mağara ve gece oyunu için.',
  },
  {
    id: 'voiceChat',
    title: 'Voice Chat',
    description: 'Simple Voice Chat — yakınlık sesli sohbet (V tuşu).',
  },
  {
    id: 'clientHudPack',
    title: 'Client HUD Paketi',
    description: 'CPS, keystrokes, zoom (C) + Minimap ve 50+ client mod (Modrinth). H menüsünden aç/kapa.',
  },
]);

export const COSMETIC_ITEMS = Object.freeze([
  { id: 'none', label: 'Kapalı', hint: 'Vanilla görünüm — ek pelerin yok.', color: null },
  { id: 'marsana-green', label: 'Marsana Yeşil', hint: 'Marka yeşili pelerin.', color: '#3d9a5f' },
  { id: 'marsana-night', label: 'Marsana Gece', hint: 'Koyu lacivert gece teması.', color: '#1a2744' },
  { id: 'marsana-gold', label: 'Marsana Altın', hint: 'Altın sarısı premium görünüm.', color: '#c9a227' },
]);

export const DEFAULT_COSMETIC = 'none';

/** Oyun içi H menüsü modu — yalnızca Marsana Client modunda */
export const CLIENT_MENU_MOD = true;

export function isClientMode(playMode) {
  return playMode === PLAY_MODES.CLIENT;
}

export const EXTERNAL_LOADERS = Object.freeze(['bedrock']);

export function isExternalLoader(loader) {
  return EXTERNAL_LOADERS.includes(loader);
}

/** Client modunda Bedrock gibi harici loader seçimleri geçersiz — preset zorunlu. */
export function sanitizeSelectionForPlayMode(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  if (isClientMode(snapshot.playMode)) {
    return applyClientPreset(snapshot);
  }
  return snapshot;
}

/** Gelişmiş launcher sekmesine geçince client paketi bayraklarını kapat. */
export function normalizePersistedSelection(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  let migrated = snapshot;
  if (typeof migrated.modSodium !== 'boolean' && migrated.modShaderFps) {
    migrated = { ...migrated, modSodium: true };
  }
  // 'forge-optifine' loader'i kaldirildi (sade 'forge' zaten var). Eski kayitlarda
  // secili kalmis kullanicilar bos/kirik secim yerine sade forge'a dussun.
  if (migrated.selectedLoader === 'forge-optifine') {
    migrated = { ...migrated, selectedLoader: 'forge' };
  }
  // 'roblox' loader'i kaldirildi (bu bir Minecraft baslaticisidir). Eski kayitlarda
  // secili kalmis kullanicilar oyun baslatamayan bos secim yerine vanilla'ya dussun.
  if (migrated.selectedLoader === 'roblox') {
    migrated = { ...migrated, selectedLoader: 'vanilla' };
  }
  const sanitized = sanitizeSelectionForPlayMode(migrated);
  if (!isClientMode(sanitized.playMode)) {
    return {
      ...sanitized,
      ...LAUNCHER_MODE_RESET,
      selectedLoader: sanitized.selectedLoader || 'vanilla',
      selectedShader: sanitized.selectedShader,
      selectedCosmetic: sanitized.selectedCosmetic ?? DEFAULT_COSMETIC,
    };
  }
  return {
    ...sanitized,
    selectedCosmetic: sanitized.selectedCosmetic ?? DEFAULT_COSMETIC,
  };
}

export const LAUNCHER_MODE_RESET = Object.freeze({
  playMode: PLAY_MODES.LAUNCHER,
  modShaderFps: false,
  modOptifine: false,
  modEmbossedBlocks: false,
  modVoiceChat: false,
  modFullbrightUb: false,
  modBetterLeaves: false,
  modGlowingOres: false,
  modRoundTrees: false,
  modCrops3d: false,
  modSchematicFarm: false,
  modSodium: false,
  modSodiumExtra: false,
  modClientHudPack: false,
});

/** Client'a özel preset'ler launcher modunda asla aktif olmamalı. */
export function sanitizeModPresetsForPlayMode(presets, playMode) {
  const p = { ...(presets || {}) };
  if (!isClientMode(playMode)) {
    p.marsanaClientMenu = false;
    p.clientHudPack = false;
  }
  return p;
}

export function applyClientPreset(base = {}) {
  return { ...base, ...CLIENT_MOD_PRESET, playMode: PLAY_MODES.CLIENT };
}
