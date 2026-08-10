import {
  isVersionAllowedForSelection,
  getVersionFilterEmptyMessage,
  LOADERS_WITH_VERSION_FILTER,
  ORNITHE_SUGGESTED_VERSION,
  isOrnitheVersionBlocked,
} from '../../shared/versionCompatibility.js';
import { recommendedShaderForVersion } from '../../shared/shaderVersionPresets.js';
import { BUNDLED_VERSION_MANIFEST } from '../generated/versionManifest.js';

export function createVersionSelector({ root, store, versionsApi, i18n }) {
  let manifest = null;
  let loaderSupportedCache = {};
  let loaderSupportedFetching = {};
  let lastFilterKey = null;
  let loadError = null;
  let loading = false;

  root.innerHTML = `
    <label class="field" data-role="version-field">
      <span data-role="version-label">Sürüm</span>
      <div class="row">
        <select data-role="type">
          <option value="release">Sadece release</option>
          <option value="snapshot">Sadece snapshot</option>
          <option value="all">Tüm sürümler</option>
        </select>
        <select data-role="version"><option value=""></option></select>
        <button type="button" class="btn ghost" data-role="version-retry" hidden>${i18n.t('version.retry')}</button>
      </div>
      <p class="hint mods-hint" data-role="version-error" style="display:none;"></p>
    </label>
    <p class="hint mods-hint" data-role="bedrock-version-hint" style="display:none;"></p>
    <p class="hint mods-hint" data-role="filter-hint" style="display:none;"></p>
  `;

  const typeSelect = root.querySelector('[data-role="type"]');
  const versionSelect = root.querySelector('[data-role="version"]');
  const versionRetryBtn = root.querySelector('[data-role="version-retry"]');
  const versionErrorHint = root.querySelector('[data-role="version-error"]');
  const versionField = root.querySelector('[data-role="version-field"]');
  const versionLabel = root.querySelector('[data-role="version-label"]');
  const bedrockVersionHint = root.querySelector('[data-role="bedrock-version-hint"]');
  const filterHint = root.querySelector('[data-role="filter-hint"]');

  function applyStaticI18n() {
    if (versionLabel) versionLabel.textContent = i18n.t('version.label');
    if (typeSelect.options[0]) typeSelect.options[0].textContent = i18n.t('version.releaseOnly');
    if (typeSelect.options[1]) typeSelect.options[1].textContent = i18n.t('version.snapshotOnly');
    if (typeSelect.options[2]) typeSelect.options[2].textContent = i18n.t('version.all');
    if (versionRetryBtn) versionRetryBtn.textContent = i18n.t('version.retry');
    if (bedrockVersionHint) bedrockVersionHint.textContent = i18n.t('version.bedrockHint');
  }

  function setVersionSelectPlaceholder(text, { disabled = true } = {}) {
    versionSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = disabled;
    opt.selected = true;
    opt.textContent = text;
    versionSelect.appendChild(opt);
    store.setState({ selectedVersion: null, selectedVersionType: 'release' });
  }

  function showVersionLoadError(message) {
    loadError = message;
    setVersionSelectPlaceholder(i18n.t('version.loadFailedShort'), { disabled: true });
    if (versionErrorHint) {
      versionErrorHint.style.display = '';
      versionErrorHint.textContent = message;
    }
    if (versionRetryBtn) versionRetryBtn.hidden = false;
  }

  function clearVersionLoadError() {
    loadError = null;
    if (versionErrorHint) {
      versionErrorHint.style.display = 'none';
      versionErrorHint.textContent = '';
    }
    if (versionRetryBtn) versionRetryBtn.hidden = true;
  }

  function withListTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sürüm listesi zaman aşımına uğradı (20 sn).')), 20000);
      }),
    ]);
  }

  async function refreshManifestFromNetwork({ force = false } = {}) {
    if (loading) return;
    if (!manifest) loading = true;
    if (force) clearVersionLoadError();
    const statusKey = force ? 'status.fetchingVersionList' : 'status.refreshingVersionList';
    store.setState({ statusText: i18n.t(statusKey) });
    try {
      const fresh = await withListTimeout(versionsApi.list(force ? { force: true } : {}));
      manifest = fresh;
      lastFilterKey = filterKey(store.getState());
      if (needsLoaderFilter()) ensureLoaderSupported(currentLoader());
      renderOptions();
      store.setState({ statusText: i18n.t('common.ready') });
    } catch (err) {
      if (!manifest) {
        const message = i18n.t('status.versionListFailed', { error: err.message || String(err) });
        showVersionLoadError(message);
        store.setState({ statusText: message });
      } else {
        store.setState({ statusText: i18n.t('common.ready') });
      }
    } finally {
      loading = false;
    }
  }

  function applyBundledManifest() {
    manifest = BUNDLED_VERSION_MANIFEST;
    lastFilterKey = filterKey(store.getState());
    renderOptions();
  }

  applyStaticI18n();

  try {
    applyBundledManifest();
  } catch (err) {
    console.error('Gomulu surum listesi yuklenemedi', err);
  }

  function typeOf(versionId) {
    if (!manifest) return 'release';
    const entry = manifest.versions.find((v) => v.id === versionId);
    return (entry && entry.type) || 'release';
  }

  function publishSelected() {
    const id = versionSelect.value;
    if (!id) {
      store.setState({ selectedVersion: null, selectedVersionType: 'release' });
      return;
    }
    const patch = { selectedVersion: id, selectedVersionType: typeOf(id) };
    const recommendedShader = recommendedShaderForVersion(id);
    if (recommendedShader) patch.selectedShader = recommendedShader;
    store.setState(patch);
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
      modSodium: !!state.modSodium,
      modSodiumExtra: !!state.modSodiumExtra,
      modFullbrightUb: !!state.modFullbrightUb,
      modBetterLeaves: !!state.modBetterLeaves,
      modGlowingOres: !!state.modGlowingOres,
      modRoundTrees: !!state.modRoundTrees,
      modCrops3d: !!state.modCrops3d,
      modSchematicFarm: !!state.modSchematicFarm,
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
    const keys = {
      'legacy-fabric': 'versionFilters.legacyFabric',
      ornithe: 'versionFilters.ornithe',
      liteloader: 'versionFilters.liteloader',
      rift: 'versionFilters.rift',
    };
    if (keys[loader]) return i18n.t(keys[loader]);
    return i18n.t('versionFilters.loaderGeneric', { loader });
  }

  function updateFilterHint(state) {
    const snap = selectionSnapshot(state);
    const parts = [];
    if (needsLoaderFilter(snap.loader)) {
      parts.push(loaderFilterLabel(snap.loader));
    }
    if (snap.loader === 'forge-optifine' || snap.modOptifine) {
      parts.push(i18n.t('versionFilters.optifine'));
    }
    if (snap.modShaderFps) {
      parts.push(
        snap.loader === 'neoforge'
          ? i18n.t('versionFilters.shaderFpsNeoForge')
          : snap.loader === 'forge'
            ? i18n.t('versionFilters.shaderFpsForge')
            : i18n.t('versionFilters.shaderFps')
      );
    }
    if (snap.modEmbossedBlocks) {
      parts.push(
        snap.loader === 'forge'
          ? i18n.t('versionFilters.embossedForge')
          : i18n.t('versionFilters.embossed')
      );
    }
    if (snap.modVoiceChat) parts.push(i18n.t('versionFilters.voiceChat'));
    if (snap.modSodium) parts.push(i18n.t('versionFilters.sodium'));
    if (snap.modSodiumExtra) parts.push(i18n.t('versionFilters.sodiumExtra'));
    if (snap.modFullbrightUb) parts.push(i18n.t('versionFilters.fullbrightUb'));
    if (snap.modBetterLeaves) parts.push(i18n.t('versionFilters.betterLeaves'));
    if (snap.modGlowingOres) parts.push(i18n.t('versionFilters.glowingOres'));
    if (snap.modRoundTrees) parts.push(i18n.t('versionFilters.roundTrees'));
    if (snap.modCrops3d) parts.push(i18n.t('versionFilters.crops3d'));
    if (snap.modSchematicFarm) parts.push(i18n.t('versionFilters.schematicFarm'));
    if (parts.length === 0) {
      filterHint.style.display = 'none';
      filterHint.textContent = '';
      return;
    }
    filterHint.style.display = '';
    filterHint.textContent = i18n.t('versionFilters.filtering', { parts: parts.join(', ') });
  }

  function updateExternalLoaderUi(state) {
    const loader = state.selectedLoader || '';
    const hideVersion = loader === 'bedrock';
    if (versionField) versionField.style.display = hideVersion ? 'none' : '';
    if (bedrockVersionHint) {
      if (loader === 'bedrock') {
        bedrockVersionHint.style.display = '';
        bedrockVersionHint.textContent = i18n.t('version.bedrockHint');
      } else {
        bedrockVersionHint.style.display = 'none';
      }
    }
    if (filterHint && hideVersion) {
      filterHint.style.display = 'none';
      filterHint.textContent = '';
    }
  }

  function renderOptions() {
    if (!manifest) {
      if (loadError) showVersionLoadError(loadError);
      else if (loading) setVersionSelectPlaceholder(i18n.t('version.loading'));
      else void refreshManifestFromNetwork();
      return;
    }
    clearVersionLoadError();
    const state = store.getState();
    updateExternalLoaderUi(state);
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
        const label = loaderFilterLabel(loader);
        setVersionSelectPlaceholder(i18n.t('versionFilters.fetching', { label }));
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
  if (versionRetryBtn) {
    versionRetryBtn.addEventListener('click', () => refreshManifestFromNetwork({ force: true }));
  }

  function mount() {
    if (!manifest) {
      try {
        applyBundledManifest();
      } catch (err) {
        console.error('Gomulu surum listesi yuklenemedi', err);
        setVersionSelectPlaceholder(i18n.t('version.loadFailedShort'));
        store.setState({
          statusText: i18n.t('status.versionListFailed', { error: err.message || String(err) }),
        });
      }
    }
    store.setState({ statusText: i18n.t('common.ready') });
    void refreshManifestFromNetwork();
    let lastSelectedLoader = store.getState().selectedLoader || '';
    const unsubs = [
      store.subscribe((state) => {
        const loader = state.selectedLoader || '';
        const extLoader = loader === 'bedrock';
        const wasExtLoader = lastSelectedLoader === 'bedrock';

        updateExternalLoaderUi(state);
        const nextKey = filterKey(state);

        if (extLoader) {
          if (state.selectedVersion !== null) {
            store.setState({ selectedVersion: null, selectedVersionType: 'release' });
          }
          lastSelectedLoader = loader;
          return;
        }

        const leftExternalLoader = wasExtLoader && !extLoader;
        if (leftExternalLoader || nextKey !== lastFilterKey) {
          lastFilterKey = nextKey;
          if (needsLoaderFilter(state.selectedLoader)) {
            ensureLoaderSupported(state.selectedLoader || 'legacy-fabric');
          }
          renderOptions();
        }

        lastSelectedLoader = loader;
      }),
      i18n.onChange(() => {
        applyStaticI18n();
        if (loadError) showVersionLoadError(loadError);
        else renderOptions();
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
