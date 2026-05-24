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
import { wireUpdateFlow } from './components/updateFlow.js';
import { wireHowToPlayGuide } from './components/howToPlayGuide.js';
import {
  loadSettings,
  applyAmbientSettings,
  DEFAULT_SETTINGS,
  wireSettingsModal,
  startAutoThemeWatcher,
} from './components/settingsModal.js';

const initialState = Object.freeze({
  user: null,
  selectedVersion: null,
  memoryMb: 2048,
  offline: false,
  offlineName: '',
  modOptifine: false,
  modShaderFps: false,
  modEmbossedBlocks: false,
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
  const store = createStore({ ...initialState, settings: persistedSettings });

  const components = [
    createAccountCard({ root: $('account-slot'), store, auth: api.auth }),
    createVersionSelector({ root: $('version-slot'), store, versionsApi: api.versions }),
    createMemorySlider({ root: $('memory-slot'), store }),
    createModsPanel({ root: $('mods-slot'), store }),
    createLaunchOptions({ root: $('launch-options-slot'), store }),
    createPlayButton({ root: $('play-slot'), store, launchApi: api.launch }),
    createStatusPanel({ root: $('status-slot'), store, events: api.events }),
    createPlayerProfileCard({ root: $('profile-slot'), store }),
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

  wireUpdateFlow({
    button: $('update-trigger'),
    overlay: $('update-overlay'),
    updates: api.updates,
  });

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
