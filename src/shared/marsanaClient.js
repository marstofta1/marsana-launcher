/** Marsana Client — tek tıkla hazır mod paketi sabitleri */

export const PLAY_MODES = Object.freeze({
  CLIENT: 'client',
  LAUNCHER: 'launcher',
});

export const DEFAULT_PLAY_MODE = PLAY_MODES.CLIENT;

/** Client modunda otomatik uygulanan loader + mod preset'i */
export const CLIENT_MOD_PRESET = Object.freeze({
  selectedLoader: 'fabric',
  selectedShader: 'complementary-reimagined',
  modShaderFps: true,
  modFullbrightUb: true,
  modVoiceChat: true,
  modOptifine: false,
  modEmbossedBlocks: false,
  modBetterLeaves: false,
  modGlowingOres: false,
  modRoundTrees: false,
  modCrops3d: false,
  modClientHudPack: true,
});

/** Client modunda kullanıcıya gösterilen özellik özeti */
export const CLIENT_FEATURES = Object.freeze([
  {
    id: 'clientMenu',
    title: 'Marsana Client Menüsü',
    description: 'Oyunda H tuşu — mod aç/kapa ve ücretsiz kozmetik.',
  },
  {
    id: 'shaderFps',
    title: 'Shader + FPS',
    description: 'Sodium + Iris ile yüksek FPS; Complementary Reimagined shader paketi.',
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

/** Gelişmiş launcher sekmesine geçince client paketi bayraklarını kapat. */
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
