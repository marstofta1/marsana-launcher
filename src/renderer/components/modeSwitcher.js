import {
  PLAY_MODES,
  CLIENT_FEATURES,
  applyClientPreset,
  isClientMode,
  LAUNCHER_MODE_RESET,
} from '../../shared/marsanaClient.js';

export function updateBranding(playMode, t) {
  const tr = typeof t === 'function' ? t : (key) => key;
  const client = isClientMode(playMode);
  document.title = client ? tr('brand.client') : tr('brand.launcher');
  document.body.classList.toggle('mode-client', client);
  document.body.classList.toggle('mode-launcher', !client);

  const brandName = document.querySelector('.brand-name');
  if (brandName) {
    const ver = brandName.querySelector('.app-version');
    const verHtml = ver ? ver.outerHTML : '';
    brandName.innerHTML = `${client ? tr('brand.client') : tr('brand.launcher')} ${verHtml}`;
  }
}

export function createModeSwitcher({ root, store, applyModIsolation, i18n }) {
  function buildMarkup() {
    const t = i18n.t;
    return `
    <div class="mode-switcher" data-role="mode-switcher">
      <button type="button" class="mode-tab active" data-mode="client">
        <span class="mode-tab-title">${t('mode.clientTitle')}</span>
        <span class="mode-tab-sub">${t('mode.clientSub')}</span>
      </button>
      <button type="button" class="mode-tab" data-mode="launcher">
        <span class="mode-tab-title">${t('mode.launcherTitle')}</span>
        <span class="mode-tab-sub">${t('mode.launcherSub')}</span>
      </button>
    </div>
    <div class="client-features" data-role="client-features" hidden>
      <p class="client-features-lead">${t('mode.clientLead')}</p>
      <ul class="client-features-list">
        ${CLIENT_FEATURES.map(
          (f) => `
          <li class="client-feature-item">
            <span class="client-feature-check" aria-hidden="true">✓</span>
            <div>
              <strong>${t(`clientFeatures.${f.id}.title`)}</strong>
              <span class="client-feature-desc">${t(`clientFeatures.${f.id}.description`)}</span>
            </div>
          </li>`
        ).join('')}
      </ul>
    </div>
  `;
  }

  function renderShell() {
    root.innerHTML = buildMarkup();
    wireTabs();
  }

  let tabs = [];
  let switcher = null;
  let clientFeatures = null;

  function wireTabs() {
    switcher = root.querySelector('[data-role="mode-switcher"]');
    clientFeatures = root.querySelector('[data-role="client-features"]');
    tabs = [...root.querySelectorAll('.mode-tab')];

    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        if (store.getState().playMode === mode) return;
        switchTo(mode);
      });
    }
  }

  function setActiveTab(mode) {
    for (const tab of tabs) {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    }
    if (clientFeatures) clientFeatures.hidden = mode !== PLAY_MODES.CLIENT;
  }

  async function switchTo(mode) {
    if (mode === PLAY_MODES.CLIENT) {
      store.setState(applyClientPreset(store.getState()));
    } else {
      store.setState(LAUNCHER_MODE_RESET);
    }
    updateBranding(mode, i18n.t);
    setActiveTab(mode);

    if (typeof applyModIsolation === 'function') {
      try {
        const state = store.getState();
        await applyModIsolation({
          playMode: mode,
          modPresets: {
            marsanaClientMenu: mode === PLAY_MODES.CLIENT,
            clientHudPack: mode === PLAY_MODES.CLIENT && !!state.modClientHudPack,
          },
        });
      } catch {
        /* ignore */
      }
    }
  }

  function renderFromStore(state) {
    const mode = state.playMode || PLAY_MODES.CLIENT;
    setActiveTab(mode);
    updateBranding(mode, i18n.t);
  }

  function mount() {
    renderShell();
    renderFromStore(store.getState());
    const unsubs = [
      store.subscribe(renderFromStore),
      i18n.onChange(() => {
        renderShell();
        renderFromStore(store.getState());
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
