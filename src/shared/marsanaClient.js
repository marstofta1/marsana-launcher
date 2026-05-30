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
});

/** Client modunda kullanıcıya gösterilen özellik özeti */
export const CLIENT_FEATURES = Object.freeze([
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
]);

export const COSMETIC_ITEMS = Object.freeze([
  { id: 'none', label: 'Kapalı', hint: 'Vanilla görünüm — ek pelerin yok.', color: null },
  { id: 'marsana-green', label: 'Marsana Yeşil', hint: 'Marka yeşili pelerin.', color: '#3d9a5f' },
  { id: 'marsana-night', label: 'Marsana Gece', hint: 'Koyu lacivert gece teması.', color: '#1a2744' },
  { id: 'marsana-gold', label: 'Marsana Altın', hint: 'Altın sarısı premium görünüm.', color: '#c9a227' },
]);

export const DEFAULT_COSMETIC = 'none';

export function isClientMode(playMode) {
  return playMode === PLAY_MODES.CLIENT;
}

export function applyClientPreset(base = {}) {
  return { ...base, ...CLIENT_MOD_PRESET, playMode: PLAY_MODES.CLIENT };
}
