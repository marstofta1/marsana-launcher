import {
  isVersionAllowedForSelection,
  getVersionFilterEmptyMessage,
} from '../../shared/versionCompatibility.js';

export function createVersionSelector({ root, store, versionsApi }) {
  let manifest = null;
  let legacyFabricSupported = null;
  let legacyFabricFetching = null;
  let lastFilterKey = null;

  root.innerHTML = `
    <label class="field">
      <span>Sürüm</span>
      <div class="row">
        <select data-role="type">
          <option value="release">Sadece release</option>
          <option value="snapshot">Sadece snapshot</option>
          <option value="all">Tüm sürümler</option>
        </select>
        <select data-role="version"><option>Yükleniyor...</option></select>
      </div>
    </label>
    <p class="hint mods-hint" data-role="filter-hint" style="display:none;"></p>
  `;

  const typeSelect = root.querySelector('[data-role="type"]');
  const versionSelect = root.querySelector('[data-role="version"]');
  const filterHint = root.querySelector('[data-role="filter-hint"]');

  function typeOf(versionId) {
    if (!manifest) return 'release';
    const entry = manifest.versions.find((v) => v.id === versionId);
    return (entry && entry.type) || 'release';
  }

  function publishSelected() {
    const id = versionSelect.value;
    store.setState({ selectedVersion: id, selectedVersionType: typeOf(id) });
  }

  function isLegacyFabric() {
    return (store.getState().selectedLoader || '') === 'legacy-fabric';
  }

  function selectionSnapshot(state = store.getState()) {
    return {
      loader: state.selectedLoader || 'vanilla',
      modOptifine: !!state.modOptifine,
      modShaderFps: !!state.modShaderFps,
      modEmbossedBlocks: !!state.modEmbossedBlocks,
    };
  }

  function filterKey(state) {
    const snap = selectionSnapshot(state);
    return JSON.stringify(snap);
  }

  function ensureLegacyFabricSupported() {
    if (legacyFabricSupported || legacyFabricFetching) return legacyFabricFetching;
    legacyFabricFetching = versionsApi
      .legacyFabricSupported()
      .then((list) => {
        legacyFabricSupported = new Set(Array.isArray(list) ? list : []);
        return legacyFabricSupported;
      })
      .catch(() => {
        legacyFabricSupported = new Set();
        return legacyFabricSupported;
      })
      .finally(() => {
        legacyFabricFetching = null;
      });
    return legacyFabricFetching;
  }

  function updateFilterHint(state) {
    const snap = selectionSnapshot(state);
    const parts = [];
    if (snap.loader === 'legacy-fabric') {
      parts.push('Legacy Fabric destekli sürümler');
    }
    if (snap.loader === 'forge-optifine' || snap.modOptifine) {
      parts.push('OptiFine uyumlu sürümler');
    }
    if (snap.modShaderFps) {
      parts.push(
        snap.loader === 'neoforge'
          ? 'NeoForge Shader + FPS uyumlu sürümler (1.20.1+ veya 1.20.2+)'
          : snap.loader === 'forge'
            ? 'Forge Shader + FPS uyumlu sürümler'
            : 'Shader + FPS uyumlu sürümler'
      );
    }
    if (snap.modEmbossedBlocks) {
      parts.push(
        snap.loader === 'forge'
          ? 'Forge kabartma (1.20.1)'
          : 'Kabartmalı blok uyumlu sürümler'
      );
    }
    if (parts.length === 0) {
      filterHint.style.display = 'none';
      filterHint.textContent = '';
      return;
    }
    filterHint.style.display = '';
    filterHint.textContent = `Seçiminize göre filtreleniyor: ${parts.join(', ')}.`;
  }

  function renderOptions() {
    if (!manifest) return;
    const state = store.getState();
    const legacy = isLegacyFabric();
    const filter = typeSelect.value;
    const snap = selectionSnapshot(state);
    const prevSelected = versionSelect.value;

    let list = manifest.versions.filter((v) => {
      if (filter === 'all') return true;
      if (filter === 'snapshot') return v.type === 'snapshot';
      return v.type === 'release';
    });

    if (legacy) {
      if (!legacyFabricSupported) {
        versionSelect.innerHTML = '<option>Legacy Fabric sürüm listesi alınıyor...</option>';
        ensureLegacyFabricSupported().then(() => renderOptions());
        return;
      }
    }

    list = list.filter((v) =>
      isVersionAllowedForSelection({
        versionId: v.id,
        versionType: v.type,
        ...snap,
        legacyFabricSupportedSet: legacy ? legacyFabricSupported : null,
      })
    );

    updateFilterHint(state);
    versionSelect.innerHTML = '';
    if (list.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = getVersionFilterEmptyMessage(snap, { legacyFabric: legacy });
      versionSelect.appendChild(opt);
      publishSelected();
      return;
    }

    for (const v of list) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.id}${v.type !== 'release' ? ` (${v.type})` : ''}`;
      versionSelect.appendChild(opt);
    }

    if (prevSelected && list.some((v) => v.id === prevSelected)) {
      versionSelect.value = prevSelected;
    } else if (!legacy && manifest.latest && filter === 'release') {
      const latestRelease = manifest.latest.release;
      if (list.some((v) => v.id === latestRelease)) {
        versionSelect.value = latestRelease;
      } else {
        versionSelect.value = list[0].id;
      }
    } else if (!legacy && manifest.latest && filter === 'snapshot' && manifest.latest.snapshot) {
      const latestSnapshot = manifest.latest.snapshot;
      if (list.some((v) => v.id === latestSnapshot)) {
        versionSelect.value = latestSnapshot;
      } else {
        versionSelect.value = list[0].id;
      }
    } else {
      versionSelect.value = list[0].id;
    }

    publishSelected();
  }

  typeSelect.addEventListener('change', renderOptions);
  versionSelect.addEventListener('change', publishSelected);

  async function mount() {
    store.setState({ statusText: 'Sürüm listesi alınıyor...' });
    try {
      manifest = await versionsApi.list();
      lastFilterKey = filterKey(store.getState());
      if (isLegacyFabric()) ensureLegacyFabricSupported();
      renderOptions();
      store.setState({ statusText: 'Hazır.' });
    } catch (err) {
      store.setState({ statusText: 'Sürüm listesi alınamadı: ' + err.message });
    }

    store.subscribe((state) => {
      const nextKey = filterKey(state);
      if (nextKey === lastFilterKey) return;
      lastFilterKey = nextKey;
      if (state.selectedLoader === 'legacy-fabric') ensureLegacyFabricSupported();
      renderOptions();
    });
  }

  return { mount };
}
