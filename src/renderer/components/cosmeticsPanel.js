import {
  COSMETIC_ITEMS,
  DEFAULT_COSMETIC,
  isClientMode,
} from '../../shared/marsanaClient.js';

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
