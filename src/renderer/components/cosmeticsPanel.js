import {
  COSMETIC_ITEMS,
  DEFAULT_COSMETIC,
  isClientMode,
} from '../../shared/marsanaClient.js';

export function createCosmeticsPanel({ root, store }) {
  root.innerHTML = `
    <div class="cosmetics-panel" data-role="cosmetics-panel">
      <div class="cosmetics-header">
        <h3>Kozmetik</h3>
        <span class="cosmetics-badge">Ücretsiz</span>
      </div>
      <p class="hint cosmetics-lead">
        Pelerin ve görünüm seçenekleri — şimdilik tamamen ücretsiz. Seçim launcher'da
        kaydedilir; oyunda <strong>H</strong> tuşu → Kozmetik sekmesinden de değiştirebilirsin.
      </p>
      <div class="cosmetics-grid" data-role="cosmetics-grid"></div>
    </div>
  `;

  const panel = root.querySelector('[data-role="cosmetics-panel"]');
  const grid = root.querySelector('[data-role="cosmetics-grid"]');

  function renderGrid(selected) {
    grid.innerHTML = COSMETIC_ITEMS.map(
      (item) => `
      <button
        type="button"
        class="cosmetic-tile${selected === item.id ? ' selected' : ''}"
        data-cosmetic="${item.id}"
        title="${item.hint}"
      >
        <span class="cosmetic-preview${item.color ? '' : ' cosmetic-preview-none'}">
          ${item.color ? `<span class="cosmetic-cape" style="--cape-color:${item.color}"></span>` : '—'}
        </span>
        <span class="cosmetic-label">${item.label}</span>
      </button>`
    ).join('');

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
    const selected = state.selectedCosmetic || DEFAULT_COSMETIC;
    renderGrid(selected);
  }

  function mount() {
    const initial = store.getState();
    if (!initial.selectedCosmetic) {
      store.setState({ selectedCosmetic: DEFAULT_COSMETIC });
    }
    renderFromStore(store.getState());
    return store.subscribe(renderFromStore);
  }

  return { mount };
}
