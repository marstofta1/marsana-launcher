export function createVersionSelector({ root, store, versionsApi }) {
  let manifest = null;
  let legacyFabricSupported = null;
  let legacyFabricFetching = null;
  let lastLoader = null;

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
  `;

  const typeSelect = root.querySelector('[data-role="type"]');
  const versionSelect = root.querySelector('[data-role="version"]');

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

  function renderOptions() {
    if (!manifest) return;
    const legacy = isLegacyFabric();
    const filter = typeSelect.value;
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
      list = list.filter((v) => legacyFabricSupported.has(v.id));
    }
    versionSelect.innerHTML = '';
    if (list.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = legacy ? 'Legacy Fabric uyumlu sürüm bulunamadı' : 'Sürüm yok';
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
    if (!legacy && manifest.latest && filter === 'release') {
      versionSelect.value = manifest.latest.release;
    } else if (!legacy && manifest.latest && filter === 'snapshot' && manifest.latest.snapshot) {
      versionSelect.value = manifest.latest.snapshot;
    }
    publishSelected();
  }

  typeSelect.addEventListener('change', renderOptions);
  versionSelect.addEventListener('change', publishSelected);

  async function mount() {
    store.setState({ statusText: 'Sürüm listesi alınıyor...' });
    try {
      manifest = await versionsApi.list();
      lastLoader = store.getState().selectedLoader || null;
      if (isLegacyFabric()) ensureLegacyFabricSupported();
      renderOptions();
      store.setState({ statusText: 'Hazır.' });
    } catch (err) {
      store.setState({ statusText: 'Sürüm listesi alınamadı: ' + err.message });
    }
    store.subscribe((state) => {
      const loader = state.selectedLoader || null;
      if (loader === lastLoader) return;
      lastLoader = loader;
      if (loader === 'legacy-fabric') ensureLegacyFabricSupported();
      renderOptions();
    });
  }

  return { mount };
}
