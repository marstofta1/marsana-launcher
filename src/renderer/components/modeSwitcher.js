import {
  PLAY_MODES,
  CLIENT_FEATURES,
  applyClientPreset,
  isClientMode,
} from '../../shared/marsanaClient.js';

const BRAND_LAUNCHER = 'Marsana Launcher';
const BRAND_CLIENT = 'Marsana Client';

export function updateBranding(playMode) {
  const client = isClientMode(playMode);
  document.title = client ? BRAND_CLIENT : BRAND_LAUNCHER;
  document.body.classList.toggle('mode-client', client);
  document.body.classList.toggle('mode-launcher', !client);

  const brandName = document.querySelector('.brand-name');
  if (brandName) {
    const ver = brandName.querySelector('.app-version');
    const verHtml = ver ? ver.outerHTML : '';
    brandName.innerHTML = `${client ? BRAND_CLIENT : BRAND_LAUNCHER} ${verHtml}`;
  }
}

export function createModeSwitcher({ root, store }) {
  root.innerHTML = `
    <div class="mode-switcher" data-role="mode-switcher">
      <button type="button" class="mode-tab active" data-mode="client">
        <span class="mode-tab-title">Marsana Client</span>
        <span class="mode-tab-sub">Hazır paket — H menüsü, FPS, Fullbright, Voice Chat</span>
      </button>
      <button type="button" class="mode-tab" data-mode="launcher">
        <span class="mode-tab-title">Gelişmiş Launcher</span>
        <span class="mode-tab-sub">Loader ve modları kendin seç</span>
      </button>
    </div>
    <div class="client-features" data-role="client-features" hidden>
      <p class="client-features-lead">
        Marsana Client, en iyi oyun deneyimi için önceden yapılandırılmış Fabric paketidir. Oyna'ya basman yeterli.
      </p>
      <ul class="client-features-list">
        ${CLIENT_FEATURES.map(
          (f) => `
          <li class="client-feature-item">
            <span class="client-feature-check" aria-hidden="true">✓</span>
            <div>
              <strong>${f.title}</strong>
              <span class="client-feature-desc">${f.description}</span>
            </div>
          </li>`
        ).join('')}
      </ul>
    </div>
  `;

  const switcher = root.querySelector('[data-role="mode-switcher"]');
  const clientFeatures = root.querySelector('[data-role="client-features"]');
  const tabs = [...root.querySelectorAll('.mode-tab')];

  function setActiveTab(mode) {
    for (const tab of tabs) {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    }
    clientFeatures.hidden = mode !== PLAY_MODES.CLIENT;
  }

  function switchTo(mode) {
    if (mode === PLAY_MODES.CLIENT) {
      store.setState(applyClientPreset(store.getState()));
    } else {
      store.setState({ playMode: PLAY_MODES.LAUNCHER });
    }
    updateBranding(mode);
    setActiveTab(mode);
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (store.getState().playMode === mode) return;
      switchTo(mode);
    });
  }

  function renderFromStore(state) {
    const mode = state.playMode || PLAY_MODES.CLIENT;
    setActiveTab(mode);
    updateBranding(mode);
  }

  function mount() {
    renderFromStore(store.getState());
    return store.subscribe(renderFromStore);
  }

  return { mount };
}
