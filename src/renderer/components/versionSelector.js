import {
  isVersionAllowedForSelection,
  getVersionFilterEmptyMessage,
  LOADERS_WITH_VERSION_FILTER,
  ORNITHE_SUGGESTED_VERSION,
  isOrnitheVersionBlocked,
} from '../../shared/versionCompatibility.js';

export function createVersionSelector({ root, store, versionsApi }) {
  let manifest = null;
  let loaderSupportedCache = {};
  let loaderSupportedFetching = {};
  let lastFilterKey = null;

  root.innerHTML = `
    <label class="field" data-role="version-field">
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
    <p class="hint mods-hint" data-role="bedrock-version-hint" style="display:none;">
      Bedrock sürümü Microsoft Store / Xbox uygulaması üzerinden otomatik güncellenir; sürüm seçimi gerekmez.
    </p>
    <p class="hint mods-hint" data-role="filter-hint" style="display:none;"></p>
  `;

  const typeSelect = root.querySelector('[data-role="type"]');
  const versionSelect = root.querySelector('[data-role="version"]');
  const versionField = root.querySelector('[data-role="version-field"]');
  const bedrockVersionHint = root.querySelector('[data-role="bedrock-version-hint"]');
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

  function currentLoader() {
    return store.getState().selectedLoader || 'vanilla';
  }

  function needsLoaderFilter(loader = currentLoader()) {
    return LOADERS_WITH_VERSION_FILTER.includes(loader);
  }

  function selectionSnapshot(state = store.getState()) {
    return {
      loader: state.selectedLoader || 'vanilla',
      modOptifine: !!state.modOptifine,
      modShaderFps: !!state.modShaderFps,
      modEmbossedBlocks: !!state.modEmbossedBlocks,
      modVoiceChat: !!state.modVoiceChat,
      modFullbrightUb: !!state.modFullbrightUb,
      modBetterLeaves: !!state.modBetterLeaves,
      modGlowingOres: !!state.modGlowingOres,
      modRoundTrees: !!state.modRoundTrees,
      modCrops3d: !!state.modCrops3d,
    };
  }

  function filterKey(state) {
    const snap = selectionSnapshot(state);
    return JSON.stringify(snap);
  }

  function ensureLoaderSupported(loader) {
    if (loaderSupportedCache[loader] || loaderSupportedFetching[loader]) {
      return loaderSupportedFetching[loader];
    }
    loaderSupportedFetching[loader] = versionsApi
      .loaderSupported(loader)
      .then((list) => {
        loaderSupportedCache[loader] = new Set(Array.isArray(list) ? list : []);
        return loaderSupportedCache[loader];
      })
      .catch(() => {
        loaderSupportedCache[loader] = new Set();
        return loaderSupportedCache[loader];
      })
      .finally(() => {
        loaderSupportedFetching[loader] = null;
      });
    return loaderSupportedFetching[loader];
  }

  function loaderFilterLabel(loader) {
    const labels = {
      'legacy-fabric': 'Legacy Fabric destekli sürümler',
      ornithe: 'Ornithe destekli sürümler',
      liteloader: 'LiteLoader destekli sürümler',
      rift: 'Rift destekli sürümler (1.13 / 1.13.2)',
    };
    return labels[loader] || `${loader} destekli sürümler`;
  }

  function updateFilterHint(state) {
    const snap = selectionSnapshot(state);
    const parts = [];
    if (needsLoaderFilter(snap.loader)) {
      parts.push(loaderFilterLabel(snap.loader));
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
    if (snap.modVoiceChat) {
      parts.push('Voice Chat uyumlu sürümler');
    }
    if (snap.modFullbrightUb) {
      parts.push('Fullbright UB uyumlu sürümler');
    }
    if (snap.modBetterLeaves) {
      parts.push('Better Leaves uyumlu sürümler');
    }
    if (snap.modGlowingOres) {
      parts.push('Glowing Ores uyumlu sürümler (1.17+)');
    }
    if (snap.modRoundTrees) {
      parts.push('Round Trees uyumlu sürümler');
    }
    if (snap.modCrops3d) {
      parts.push('3D crops Revamped uyumlu sürümler');
    }
    if (parts.length === 0) {
      filterHint.style.display = 'none';
      filterHint.textContent = '';
      return;
    }
    filterHint.style.display = '';
    filterHint.textContent = `Seçiminize göre filtreleniyor: ${parts.join(', ')}.`;
  }

  function updateBedrockUi(state) {
    const isBedrock = (state.selectedLoader || '') === 'bedrock';
    if (versionField) versionField.style.display = isBedrock ? 'none' : '';
    if (bedrockVersionHint) bedrockVersionHint.style.display = isBedrock ? '' : 'none';
    if (filterHint && isBedrock) {
      filterHint.style.display = 'none';
      filterHint.textContent = '';
    }
  }

  function renderOptions() {
    if (!manifest) return;
    const state = store.getState();
    updateBedrockUi(state);
    if ((state.selectedLoader || '') === 'bedrock') {
      if (state.selectedVersion !== null) {
        store.setState({ selectedVersion: null, selectedVersionType: 'release' });
      }
      return;
    }
    const loader = currentLoader();
    const filteredLoader = needsLoaderFilter(loader);
    const filter = typeSelect.value;
    const snap = selectionSnapshot(state);
    const prevSelected = versionSelect.value;

    let list = manifest.versions.filter((v) => {
      if (filter === 'all') return true;
      if (filter === 'snapshot') return v.type === 'snapshot';
      return v.type === 'release';
    });

    if (filteredLoader) {
      if (!loaderSupportedCache[loader]) {
        versionSelect.innerHTML = `<option>${loaderFilterLabel(loader)} alınıyor...</option>`;
        ensureLoaderSupported(loader).then(() => renderOptions());
        return;
      }
    }

    list = list.filter((v) =>
      isVersionAllowedForSelection({
        versionId: v.id,
        versionType: v.type,
        ...snap,
        loaderSupportedSet: filteredLoader ? loaderSupportedCache[loader] : null,
      })
    );

    updateFilterHint(state);
    versionSelect.innerHTML = '';
    if (list.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = getVersionFilterEmptyMessage(snap, { loader });
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

    if (prevSelected && list.some((v) => v.id === prevSelected) && !isOrnitheVersionBlocked(prevSelected)) {
      versionSelect.value = prevSelected;
    } else if (loader === 'ornithe' && list.some((v) => v.id === ORNITHE_SUGGESTED_VERSION)) {
      versionSelect.value = ORNITHE_SUGGESTED_VERSION;
    } else if (!filteredLoader && manifest.latest && filter === 'release') {
      const latestRelease = manifest.latest.release;
      if (list.some((v) => v.id === latestRelease)) {
        versionSelect.value = latestRelease;
      } else {
        versionSelect.value = list[0].id;
      }
    } else if (!filteredLoader && manifest.latest && filter === 'snapshot' && manifest.latest.snapshot) {
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
      if (needsLoaderFilter()) ensureLoaderSupported(currentLoader());
      renderOptions();
      store.setState({ statusText: 'Hazır.' });
    } catch (err) {
      store.setState({ statusText: 'Sürüm listesi alınamadı: ' + err.message });
    }

    store.subscribe((state) => {
      updateBedrockUi(state);
      const nextKey = filterKey(state);
      if ((state.selectedLoader || '') === 'bedrock') {
        if (state.selectedVersion !== null) {
          store.setState({ selectedVersion: null, selectedVersionType: 'release' });
        }
        return;
      }
      if (nextKey === lastFilterKey) return;
      lastFilterKey = nextKey;
      if (needsLoaderFilter(state.selectedLoader)) {
        ensureLoaderSupported(state.selectedLoader || 'legacy-fabric');
      }
      renderOptions();
    });
  }

  return { mount };
}
