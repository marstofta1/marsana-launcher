/** Hazır mod paketleri — tek tıkla yükleyici + mod seçimi (Gelişmiş Launcher). */

import { LAUNCHER_MODE_RESET } from './marsanaClient.js';
import { CREATE_MOD_LOADER } from './versionCompatibility.js';

/**
 * `mods`: pakette açılan mod bayrakları (gerisi kapatılır).
 * `fpsBoost`: Fabric'te ek FPS/RAM modları + video ayarı (render mesafesi 12) uygulanır;
 * Create paketi kendi optimizasyonunu NeoForge kurulumunda zaten yapar.
 * `fpsUnlimited`: FPS sınırı kaldırılır; kapalıysa paket 120 FPS'te sabitlenir.
 */
export const MOD_PACKS = Object.freeze([
  {
    // Shader, OptiFine ve Create dışındaki tüm modlar.
    id: 'full',
    loader: 'fabric',
    fpsBoost: true,
    fpsUnlimited: false,
    mods: Object.freeze({
      modEmbossedBlocks: true,
      modVoiceChat: true,
      modSodium: true,
      modSodiumExtra: true,
      modFullbrightUb: true,
      modBetterLeaves: true,
      modGlowingOres: true,
      modRoundTrees: true,
      modCrops3d: true,
      modSchematicFarm: true,
    }),
  },
  {
    // Yalnızca 1.14 – 1.21.10 (versionCompatibility.fpsPackSupported).
    id: 'fps',
    loader: 'fabric',
    fpsBoost: true,
    fpsUnlimited: true,
    mods: Object.freeze({ modSodium: true, modSodiumExtra: true }),
  },
  {
    id: 'create',
    loader: CREATE_MOD_LOADER,
    fpsBoost: false,
    mods: Object.freeze({ modCreate: true }),
  },
]);

export function findModPack(id) {
  return MOD_PACKS.find((p) => p.id === id) || null;
}

/** Paketi seçince store'a yazılacak yama: önce tüm modlar kapanır, sonra paketinkiler açılır. */
export function modPackSelectionPatch(pack) {
  return {
    ...LAUNCHER_MODE_RESET,
    ...pack.mods,
    selectedLoader: pack.loader,
    selectedModPack: pack.id,
  };
}

export function modPackClearPatch() {
  return { ...LAUNCHER_MODE_RESET, selectedModPack: null };
}

/** Yükleyici değişti ya da paketin ana modu kapatıldıysa paket artık seçili sayılmaz. */
export function modPackStillApplies(state, pack) {
  if (!state || !pack) return false;
  if ((state.selectedLoader || '') !== pack.loader) return false;
  if (pack.mods.modCreate && !state.modCreate) return false;
  return true;
}

/** Başlatma önayarları: { fpsBoost, fpsUnlimited } — paket seçili değilse ikisi de kapalı. */
export function modPackLaunchPresets(state) {
  const pack = findModPack(state && state.selectedModPack);
  const fpsBoost = !!(pack && pack.fpsBoost && modPackStillApplies(state, pack));
  return { fpsBoost, fpsUnlimited: fpsBoost && !!pack.fpsUnlimited };
}
