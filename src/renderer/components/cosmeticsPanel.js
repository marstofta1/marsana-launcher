import {
  COSMETIC_ITEMS,
  DEFAULT_COSMETIC,
  isClientMode,
} from '../../shared/marsanaClient.js';

/** Pelerin dokusunun arkadan görünen yüzünü (64x32 içinde x1,y1 10x16) 3x büyütüp çizer. */
function drawCape(canvas, id) {
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 1, 1, 10, 16, 0, 0, canvas.width, canvas.height);
  };
  img.src = `assets/capes/${id}.png`;
}

export function createCosmeticsPanel({ root, store, i18n }) {
  root.innerHTML = `
    <div class="cosmetics-panel" data-role="cosmetics-panel">
      <div class="cosmetics-header">
        <h3 data-role="cosmetics-title">Kozmetik</h3>
        <span class="cosmetics-badge" data-role="cosmetics-badge">Ücretsiz</span>
      </div>
      <p class="hint cosmetics-lead" data-role="cosmetics-lead">
        Pelerin ve görünüm seçenekleri — şimdilik tamamen ücretsiz.
      </p>
      <div class="cosmetics-grid" data-role="cosmetics-grid"></div>
    </div>
  `;

  const panel = root.querySelector('[data-role="cosmetics-panel"]');
  const grid = root.querySelector('[data-role="cosmetics-grid"]');
  const titleEl = root.querySelector('[data-role="cosmetics-title"]');
  const badgeEl = root.querySelector('[data-role="cosmetics-badge"]');
  const leadEl = root.querySelector('[data-role="cosmetics-lead"]');

  function applyStaticI18n() {
    if (titleEl) titleEl.textContent = i18n.t('cosmetics.title');
    if (badgeEl) badgeEl.textContent = i18n.t('cosmetics.freeNote');
    if (leadEl) leadEl.textContent = i18n.t('cosmetics.lead');
  }

  function renderGrid(selected) {
    // Çeviri yoksa (anahtar geri dönerse) marsanaClient.js'teki Türkçe metne düş.
    const tr = (key, fallback) => {
      const v = i18n.t(key);
      return v && v !== key ? v : fallback;
    };
    grid.innerHTML = COSMETIC_ITEMS.map((raw) => ({
      ...raw,
      label: tr(`cosmetics.items.${raw.id}.label`, raw.label),
      hint: tr(`cosmetics.items.${raw.id}.hint`, raw.hint),
    })).map(
      (item) => `
      <button
        type="button"
        class="cosmetic-tile${selected === item.id ? ' selected' : ''}"
        data-cosmetic="${item.id}"
        title="${item.hint}"
      >
        <span class="cosmetic-preview${item.color ? '' : ' cosmetic-preview-none'}">
          ${item.color ? `<canvas class="cosmetic-cape-canvas" width="30" height="48" data-cape="${item.id}"></canvas>` : '—'}
        </span>
        <span class="cosmetic-label">${item.label}</span>
      </button>`
    ).join('');

    for (const canvas of grid.querySelectorAll('canvas[data-cape]')) drawCape(canvas, canvas.dataset.cape);

    for (const btn of grid.querySelectorAll('.cosmetic-tile')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cosmetic;
        if (store.getState().selectedCosmetic === id) return;
        store.setState({ selectedCosmetic: id });
      });
    }
  }

  function renderFromStore(state) {
    const client = isClientMode(state.playMode);
    panel.hidden = !client;
    if (!client) return;
    applyStaticI18n();
    const selected = state.selectedCosmetic || DEFAULT_COSMETIC;
    renderGrid(selected);
  }

  function mount() {
    const initial = store.getState();
    if (!initial.selectedCosmetic) {
      store.setState({ selectedCosmetic: DEFAULT_COSMETIC });
    }
    renderFromStore(store.getState());
    const unsubs = [
      store.subscribe(renderFromStore),
      i18n.onChange(() => renderFromStore(store.getState())),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
