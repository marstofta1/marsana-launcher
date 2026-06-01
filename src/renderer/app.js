import * as api from './api.js';
import { createStore } from './state/store.js';

import { createAccountCard } from './components/accountCard.js';
import { createVersionSelector } from './components/versionSelector.js';
import { createMemorySlider } from './components/memorySlider.js';
import { createModsPanel } from './components/modsPanel.js';
import { createLaunchOptions } from './components/launchOptions.js';
import { createPlayButton } from './components/playButton.js';
import { createStatusPanel } from './components/statusPanel.js';
import { createFirstRunNotice } from './components/firstRunNotice.js';
import { createRecommendedServers } from './components/recommendedServers.js';
import { createPlayerProfileCard } from './components/playerProfileCard.js';
import { createBottomLinks } from './components/bottomLinks.js';
import { createWebsiteLinksPanel } from './components/websiteLinksPanel.js';
import { createModeSwitcher, updateBranding } from './components/modeSwitcher.js';
import { createCosmeticsPanel } from './components/cosmeticsPanel.js';
import { wireUpdateFlow } from './components/updateFlow.js';
import {
  DEFAULT_PLAY_MODE,
  CLIENT_MOD_PRESET,
  DEFAULT_COSMETIC,
  normalizePersistedSelection,
} from '../shared/marsanaClient.js';
import { wireHowToPlayGuide } from './components/howToPlayGuide.js';
import {
  loadSettings,
  applyAmbientSettings,
  DEFAULT_SETTINGS,
  wireSettingsModal,
  startAutoThemeWatcher,
  loadLastSelection,
  saveLastSelection,
  clearLastSelection,
} from './components/settingsModal.js';

const initialState = Object.freeze({
  user: null,
  selectedVersion: null,
  playMode: DEFAULT_PLAY_MODE,
  selectedCosmetic: DEFAULT_COSMETIC,
  selectedLoader: CLIENT_MOD_PRESET.selectedLoader,
  selectedShader: CLIENT_MOD_PRESET.selectedShader,
  memoryMb: 2048,
  offline: false,
  offlineName: '',
  modOptifine: CLIENT_MOD_PRESET.modOptifine,
  modShaderFps: CLIENT_MOD_PRESET.modShaderFps,
  modEmbossedBlocks: CLIENT_MOD_PRESET.modEmbossedBlocks,
  modVoiceChat: CLIENT_MOD_PRESET.modVoiceChat,
  modFullbrightUb: CLIENT_MOD_PRESET.modFullbrightUb,
  modBetterLeaves: CLIENT_MOD_PRESET.modBetterLeaves,
  modGlowingOres: CLIENT_MOD_PRESET.modGlowingOres,
  modRoundTrees: CLIENT_MOD_PRESET.modRoundTrees,
  modCrops3d: CLIENT_MOD_PRESET.modCrops3d,
  modClientHudPack: CLIENT_MOD_PRESET.modClientHudPack,
  statusText: 'Hazır.',
  progressPercent: 0,
  logLines: [],
  settings: { ...DEFAULT_SETTINGS },
});

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Slot bulunamadı: #${id}`);
  return el;
}

async function bootstrap() {
  const persistedSettings = loadSettings();
  applyAmbientSettings(persistedSettings);

  const verEl = document.querySelector('.app-version');
  if (verEl && api.app && typeof api.app.getVersion === 'function') {
    try {
      const v = await api.app.getVersion();
      if (v) verEl.textContent = `v${v}`;
    } catch {
      /* ignore */
    }
  }

  // "Seçimleri hatırla" açıkken son kayıtlı loader/mod snapshot'unu initial
  // state'e enjekte et. Kapalıyken varsayılan Marsana Client preset'i gelir.
  const seededState = { ...initialState };
  if (persistedSettings.rememberSelection) {
    const last = loadLastSelection();
    if (last) Object.assign(seededState, normalizePersistedSelection(last));
  }
  const store = createStore({ ...seededState, settings: persistedSettings });
  updateBranding(store.getState().playMode);

  wireUpdateFlow({
    button: $('update-trigger'),
    overlay: $('update-overlay'),
    updates: api.updates,
  });

  // Store değişimlerini dinle: "Seçimleri hatırla" açıkken loader/preset
  // değiştiğinde otomatik kaydet; setting kapatıldığında saklananı temizle.
  // lastSerialized — aynı snapshot'u tekrar tekrar yazmamak için.
  let prevRemember = !!persistedSettings.rememberSelection;
  let lastSerialized = null;
  store.subscribe((state) => {
    const settings = state.settings || {};
    const nowRemember = !!settings.rememberSelection;
    if (prevRemember && !nowRemember) {
      clearLastSelection();
      lastSerialized = null;
    }
    prevRemember = nowRemember;
    if (!nowRemember) return;
    const snap = normalizePersistedSelection({
      playMode: state.playMode || DEFAULT_PLAY_MODE,
      selectedCosmetic: state.selectedCosmetic || DEFAULT_COSMETIC,
      selectedLoader: state.selectedLoader,
      selectedShader: state.selectedShader,
      modOptifine: !!state.modOptifine,
      modShaderFps: !!state.modShaderFps,
      modEmbossedBlocks: !!state.modEmbossedBlocks,
      modVoiceChat: !!state.modVoiceChat,
      modFullbrightUb: !!state.modFullbrightUb,
      modBetterLeaves: !!state.modBetterLeaves,
      modGlowingOres: !!state.modGlowingOres,
      modRoundTrees: !!state.modRoundTrees,
      modCrops3d: !!state.modCrops3d,
      modClientHudPack: !!state.modClientHudPack,
    });
    const ser = JSON.stringify(snap);
    if (ser !== lastSerialized) {
      lastSerialized = ser;
      saveLastSelection(snap);
    }
  });

  const components = [
    createAccountCard({ root: $('account-slot'), store, auth: api.auth }),
    createVersionSelector({ root: $('version-slot'), store, versionsApi: api.versions }),
    createMemorySlider({ root: $('memory-slot'), store }),
    createModsPanel({ root: $('mods-slot'), store }),
    createLaunchOptions({ root: $('launch-options-slot'), store }),
    createPlayButton({ root: $('play-slot'), store, launchApi: api.launch }),
    createStatusPanel({ root: $('status-slot'), store, events: api.events }),
    createPlayerProfileCard({ root: $('profile-slot'), store }),
    createCosmeticsPanel({ root: $('cosmetics-slot'), store }),
    createWebsiteLinksPanel({ root: $('website-links-slot'), openExternal: api.openExternal }),
    createRecommendedServers({
      root: $('servers-slot'),
      store,
      serversApi: api.servers,
      openExternal: api.openExternal,
    }),
    createFirstRunNotice({ root: $('modal-slot') }),
    createBottomLinks({ root: $('bottom-links-slot'), openExternal: api.openExternal }),
  ];

  for (const c of components) await c.mount();

  createModeSwitcher({ root: $('mode-switcher-slot'), store }).mount();

  wireHowToPlayGuide({
    button: $('how-to-play-trigger'),
    modalRoot: $('how-to-play-slot'),
  });

  wireSettingsModal({
    button: $('settings-trigger'),
    modalRoot: $('settings-modal-slot'),
    store,
  });

  startAutoThemeWatcher(store);

  const cached = await api.auth.current();
  if (cached) {
    store.setState({ user: cached });
    const refreshed = await api.auth.refresh();
    if (refreshed) store.setState({ user: refreshed });
  }
}

bootstrap().catch((err) => {
  console.error('Bootstrap error', err);
});
