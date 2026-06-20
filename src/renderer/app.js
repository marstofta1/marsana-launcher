import * as api from './api.js';
import { createStore } from './state/store.js';
import { initI18n } from './i18n/index.js';

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
import { createPlatformsPanel } from './components/platformsPanel.js';
import { initBootSplash, setBootSplashStatus, dismissBootSplash } from './bootSplash.js';
import { createModeSwitcher, updateBranding } from './components/modeSwitcher.js';
import { createCosmeticsPanel } from './components/cosmeticsPanel.js';
import { wireUpdateFlow } from './components/updateFlow.js';
import {
  DEFAULT_PLAY_MODE,
  CLIENT_MOD_PRESET,
  DEFAULT_COSMETIC,
  normalizePersistedSelection,
  sanitizeSelectionForPlayMode,
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

function $(id, { optional = false } = {}) {
  const el = document.getElementById(id);
  if (!el) {
    if (optional) return null;
    throw new Error(`Slot bulunamadı: #${id}`);
  }
  return el;
}

async function mountAll(entries) {
  const failures = [];
  await Promise.all(
    entries.map(async ({ name, mount }) => {
      if (!mount) return;
      try {
        await mount();
      } catch (err) {
        console.error(`[bootstrap] ${name} yüklenemedi`, err);
        failures.push({ name, err });
      }
    })
  );
  if (failures.length > 0) {
    const names = failures.map((f) => f.name).join(', ');
    console.warn(`[bootstrap] Kısmi yükleme hatası: ${names}`);
  }
}

async function bootstrap() {
  initBootSplash();
  const persistedSettings = loadSettings();
  applyAmbientSettings(persistedSettings);
  setBootSplashStatus('Ayarlar yükleniyor…');

  const verEl = document.querySelector('.app-version');
  if (verEl && api.app && typeof api.app.getVersion === 'function') {
    try {
      const v = await api.app.getVersion();
      if (v) verEl.textContent = `v${v}`;
    } catch {
      /* ignore */
    }
  }

  const seededState = {
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
    modSchematicFarm: CLIENT_MOD_PRESET.modSchematicFarm,
    modClientHudPack: CLIENT_MOD_PRESET.modClientHudPack,
    statusText: '',
    progressPercent: 0,
    logLines: [],
    settings: { ...DEFAULT_SETTINGS, ...persistedSettings },
  };

  if (persistedSettings.rememberSelection) {
    const last = loadLastSelection();
    if (last) Object.assign(seededState, normalizePersistedSelection(last));
  }
  Object.assign(seededState, sanitizeSelectionForPlayMode(seededState));

  const store = createStore(seededState);
  const i18n = initI18n(store);
  store.setState({ statusText: i18n.t('common.ready') });
  updateBranding(store.getState().playMode, i18n.t);

  wireUpdateFlow({
    button: $('update-trigger'),
    overlay: $('update-overlay'),
    updates: api.updates,
    i18n,
  });

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
      modSchematicFarm: !!state.modSchematicFarm,
      modClientHudPack: !!state.modClientHudPack,
    });
    const ser = JSON.stringify(snap);
    if (ser !== lastSerialized) {
      lastSerialized = ser;
      saveLastSelection(snap);
    }
  });

  const components = [
    { name: 'account', mount: createAccountCard({ root: $('account-slot'), store, auth: api.auth, openExternal: api.openExternal, i18n }).mount },
    { name: 'version', mount: createVersionSelector({ root: $('version-slot'), store, versionsApi: api.versions, i18n }).mount },
    { name: 'memory', mount: createMemorySlider({ root: $('memory-slot'), store, i18n }).mount },
    { name: 'play', mount: createPlayButton({ root: $('play-slot'), store, launchApi: api.launch, i18n, robloxApi: api.roblox }).mount },
    { name: 'mods', mount: createModsPanel({ root: $('mods-slot'), store, i18n }).mount },
    { name: 'launchOptions', mount: createLaunchOptions({ root: $('launch-options-slot'), store, i18n }).mount },
    { name: 'status', mount: createStatusPanel({ root: $('status-slot'), store, events: api.events }).mount },
    { name: 'profile', mount: createPlayerProfileCard({ root: $('profile-slot'), store, i18n }).mount },
    { name: 'cosmetics', mount: createCosmeticsPanel({ root: $('cosmetics-slot'), store, i18n }).mount },
    ...( $('platforms-slot', { optional: true })
      ? [{
          name: 'platforms',
          mount: createPlatformsPanel({
            root: $('platforms-slot'),
            openExternal: api.openExternal,
            i18n,
            getNativePlatform: () => api.app.getPlatform(),
          }).mount,
        }]
      : []),
    { name: 'websites', mount: createWebsiteLinksPanel({ root: $('website-links-slot'), openExternal: api.openExternal, i18n }).mount },
    { name: 'servers', mount: createRecommendedServers({
      root: $('servers-slot'),
      store,
      serversApi: api.servers,
      openExternal: api.openExternal,
      i18n,
    }).mount },
    { name: 'firstRun', mount: createFirstRunNotice({ root: $('modal-slot'), i18n }).mount },
    { name: 'bottomLinks', mount: createBottomLinks({ root: $('bottom-links-slot'), openExternal: api.openExternal, i18n }).mount },
  ];

  setBootSplashStatus('Arayüz hazırlanıyor…');
  await mountAll([
    ...components,
    {
      name: 'modeSwitcher',
      mount: createModeSwitcher({
        root: $('mode-switcher-slot'),
        store,
        applyModIsolation: api.applyModIsolation,
        i18n,
      }).mount,
    },
  ]);

  try {
    wireHowToPlayGuide({
      button: $('how-to-play-trigger'),
      modalRoot: $('how-to-play-slot'),
      i18n,
    });
    wireSettingsModal({
      button: $('settings-trigger'),
      modalRoot: $('settings-modal-slot'),
      store,
      i18n,
      robloxApi: api.roblox,
      openExternal: api.openExternal,
    });
    startAutoThemeWatcher(store);
  } catch (err) {
    console.error('[bootstrap] Ayarlar / rehber bağlanamadı', err);
  }

  setBootSplashStatus('Hesap kontrol ediliyor…');
  const AUTH_BOOT_TIMEOUT_MS = 15000;
  const authWork = (async () => {
    const cached = await api.auth.current();
    if (cached) {
      const patch = { user: cached };
      if (cached.bedrockOnly) patch.selectedLoader = 'bedrock';
      store.setState(patch);
      if (cached.bedrockOnly) {
        store.setState({
          statusText: i18n.t('auth.bedrockOnlyReady', { name: cached.name }),
        });
      }
      const refreshed = await api.auth.refresh();
      if (refreshed) {
        const refreshPatch = { user: refreshed };
        if (refreshed.bedrockOnly) refreshPatch.selectedLoader = 'bedrock';
        else Object.assign(refreshPatch, sanitizeSelectionForPlayMode(store.getState()));
        store.setState(refreshPatch);
      }
    }
  })();

  await Promise.race([
    authWork,
    new Promise((resolve) => setTimeout(resolve, AUTH_BOOT_TIMEOUT_MS)),
  ]);
  dismissBootSplash();
}

bootstrap().catch((err) => {
  console.error('Bootstrap error', err);
  dismissBootSplash();
  const banner = document.createElement('div');
  banner.className = 'bootstrap-error-banner';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = `<strong>Arayüz yüklenemedi.</strong> ${err?.message || String(err)}`;
  document.body.prepend(banner);
});
