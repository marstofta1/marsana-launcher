import { isClientMode } from '../../shared/marsanaClient.js';
import {
  MOD_PACKS,
  findModPack,
  modPackSelectionPatch,
  modPackClearPatch,
  modPackStillApplies,
} from '../../shared/modPacks.js';

export function createModPacksPanel({ root, store, i18n }) {
  root.innerHTML = `
    <h3 class="section-title" data-role="packs-title"></h3>
    <p class="hint mod-packs-lead" data-role="packs-lead"></p>
    <div class="mod-packs-grid">
      ${MOD_PACKS.map(
        (p) => `
        <button type="button" class="mode-tab mod-pack-card" data-pack="${p.id}" aria-pressed="false">
          <span class="mode-tab-title" data-role="pack-title"></span>
          <span class="mode-tab-sub" data-role="pack-desc"></span>
        </button>`
      ).join('')}
    </div>
  `;

  const title = root.querySelector('[data-role="packs-title"]');
  const lead = root.querySelector('[data-role="packs-lead"]');
  const cards = [...root.querySelectorAll('.mod-pack-card')];

  function render(state) {
    root.style.display = isClientMode(state.playMode) ? 'none' : '';
    title.textContent = i18n.t('modPacks.title');
    lead.textContent = i18n.t('modPacks.lead');
    const bedrockOnly = !!state.user?.bedrockOnly;
    // Mod seçenekleri snapshot/eski sürümlerde kapanır; Create kendi sürümünü (1.21.1) sabitler.
    const nonRelease = !!state.selectedVersionType && state.selectedVersionType !== 'release';
    for (const card of cards) {
      const pack = findModPack(card.dataset.pack);
      const active = state.selectedModPack === pack.id;
      const blocked = !pack.mods.modCreate && nonRelease;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
      card.disabled = bedrockOnly || (blocked && !active);
      card.title = blocked ? i18n.t('modPacks.needsRelease') : '';
      card.querySelector('[data-role="pack-title"]').textContent = i18n.t(`modPacks.${pack.id}.title`);
      card.querySelector('[data-role="pack-desc"]').textContent = i18n.t(`modPacks.${pack.id}.desc`);
    }
  }

  for (const card of cards) {
    card.addEventListener('click', () => {
      const pack = findModPack(card.dataset.pack);
      const active = store.getState().selectedModPack === pack.id;
      store.setState(active ? modPackClearPatch() : modPackSelectionPatch(pack));
    });
  }

  function onState(state) {
    const pack = findModPack(state.selectedModPack);
    if (pack && !modPackStillApplies(state, pack)) {
      store.setState({ selectedModPack: null });
      return;
    }
    render(state);
  }

  function mount() {
    render(store.getState());
    const unsubs = [
      store.subscribe(onState),
      i18n.onChange(() => render(store.getState())),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
