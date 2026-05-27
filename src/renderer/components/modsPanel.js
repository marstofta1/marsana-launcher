import {
  shaderFpsSupported,
  embossedBlocksSupported,
  optifineSupported,
  forgeOptifineLikelySupported,
} from '../../shared/versionCompatibility.js';

const LOADER_OPTIONS = [
  { value: 'vanilla', label: 'Vanilla', hint: 'Saf Minecraft — hiçbir loader veya mod yüklenmez. Mojang\'ın resmi sürümü olduğu gibi başlar.' },
  { value: 'fabric', label: 'Fabric', hint: 'Modrinth modları (Sodium, Iris, OptiFine for Fabric, vs.). Aşağıdaki seçenekler aktif olur.' },
  { value: 'forge', label: 'Forge', hint: 'Klasik Forge loader (boş profil). Modlarınızı mods/ klasörüne kendiniz eklersiniz.' },
  { value: 'forge-optifine', label: 'Forge + OptiFine', hint: 'Forge loader + optifine.net’ten klasik OptiFine.jar otomatik indirilir.' },
  { value: 'neoforge', label: 'NeoForge', hint: 'Forge’un modern çatalı (1.20.2+). Boş profil; modlarınızı mods/ klasörüne kendiniz eklersiniz.' },
  { value: 'quilt', label: 'Quilt', hint: 'Fabric’in çatalı; çoğu Fabric modu Quilt ile uyumludur. Boş profil olarak başlar.' },
  { value: 'legacy-fabric', label: 'Legacy Fabric', hint: 'Eski Minecraft sürümleri (1.3 – 1.13.2) için Fabric çatalı. Sürüm listesi otomatik filtrelenir; boş profil olarak başlar.' },
];

const FABRIC_LOADER = 'fabric';
const DEFAULT_LOADER = 'fabric';

// Modrinth slug → görünür isim. Shader+FPS preset'i seçildiğinde kullanıcı
// bunlardan birini seçebilir. Slug'lar Modrinth search API'siyle doğrulandı.
const SHADER_OPTIONS = [
  { slug: 'complementary-reimagined',  label: 'Complementary Reimagined' },
  { slug: 'complementary-unbound',     label: 'Complementary Unbound' },
  { slug: 'bsl-shaders',               label: 'BSL Shaders' },
  { slug: 'photon-shader',             label: 'Photon Shaders' },
  { slug: 'solas-shader',              label: 'Solas Shader' },
  { slug: 'bliss-shader',              label: 'Bliss Shaders' },
  { slug: 'rethinking-voxels',         label: 'Rethinking Voxels' },
  { slug: 'makeup-ultra-fast-shaders', label: 'MakeUp – Ultra Fast' },
  { slug: 'super-duper-vanilla',       label: 'Super Duper Vanilla' },
  { slug: 'insanity-shader',           label: 'Insanity Shader' },
  { slug: 'pastel-shaders',            label: 'Pastel Shaders' },
  { slug: 'mellow',                    label: 'Mellow' },
  { slug: 'astralex',                  label: 'AstraLex Shaders' },
  { slug: 'nostalgia-shader',          label: 'Nostalgia Shader' },
  { slug: 'miniature-shader',          label: 'Miniature Shader' },
  { slug: 'vanillaa',                  label: 'VanillAA' },
  { slug: 'hysteria-shaders',          label: 'Hysteria Shaders' },
  { slug: 'kappa-shader',              label: 'Kappa Shader' },
  { slug: 'spooklementary',            label: 'Spooklementary' },
];
const DEFAULT_SHADER_SLUG = 'complementary-reimagined';

export function createModsPanel({ root, store }) {
  const loaderRadios = LOADER_OPTIONS.map(
    (opt) => `
      <label class="field radio">
        <input type="radio" name="loader" value="${opt.value}" data-role="loader-${opt.value}" />
        <span>${opt.label}</span>
      </label>
      <p class="hint mods-hint" data-role="hint-loader-${opt.value}">${opt.hint}</p>
    `
  ).join('');

  root.innerHTML = `
    <h3 class="section-title">Mod Yükleyici</h3>
    ${loaderRadios}

    <div class="mods-options" data-role="mods-options">
      <h3 class="section-title" data-role="mods-title">Mod Seçenekleri</h3>

      <div data-role="row-shaderFps">
        <label class="field checkbox">
          <input type="checkbox" data-role="shaderFps" />
          <span data-role="label-shaderFps">Shader + FPS</span>
        </label>
        <label class="field" data-role="shader-picker-field" style="display:none;">
          <span>Shader paketi</span>
          <select data-role="shader-picker">
            ${SHADER_OPTIONS.map(
              (o) => `<option value="${o.slug}">${o.label}</option>`
            ).join('')}
          </select>
        </label>
        <p class="hint mods-hint" data-role="hint-shader">
          Gerçekçi ışık ve gölgeler; en akıcı oyun için oyunda shader paketinde <strong>Performance</strong> profilini seçin.
        </p>
      </div>

      <div data-role="row-optifine">
        <label class="field checkbox">
          <input type="checkbox" data-role="optifine" />
          <span>OptiFine (Fabric — Modrinth OptiFine for Fabric paketi)</span>
        </label>
        <p class="hint mods-hint" data-role="hint-optifine">
          Zoom, animasyonlar ve video ayarları; tam mod paketi olarak indirilir. <strong>Shader + FPS</strong> ile aynı anda seçilemez.
        </p>
      </div>

      <div data-role="row-embossed">
        <label class="field checkbox">
          <input type="checkbox" data-role="embossed" />
          <span data-role="label-embossed">Kabartmalı / bağlı bloklar (Continuity + Sodium)</span>
        </label>
        <p class="hint mods-hint" data-role="hint-embossed">
          Cam ve benzeri bloklarda bağlı doku (CTM). <strong>1.18+</strong> klasik sürümlerde önerilir; OptiFine paketi açıkken ek modlar isteğe bağlı eklenir.
        </p>
      </div>
    </div>

    <p class="hint mods-footnote" data-role="loader-warning" style="display:none;"></p>
  `;

  const optifineCb = root.querySelector('[data-role="optifine"]');
  const shaderCb = root.querySelector('[data-role="shaderFps"]');
  const embossedCb = root.querySelector('[data-role="embossed"]');
  const optifineRow = root.querySelector('[data-role="row-optifine"]');
  const shaderRow = root.querySelector('[data-role="row-shaderFps"]');
  const embossedRow = root.querySelector('[data-role="row-embossed"]');
  const shaderLabel = root.querySelector('[data-role="label-shaderFps"]');
  const embossedLabel = root.querySelector('[data-role="label-embossed"]');
  const shaderPickerField = root.querySelector('[data-role="shader-picker-field"]');
  const shaderPicker = root.querySelector('[data-role="shader-picker"]');
  const modsTitle = root.querySelector('[data-role="mods-title"]');
  const modsOptionsBox = root.querySelector('[data-role="mods-options"]');
  const loaderWarning = root.querySelector('[data-role="loader-warning"]');
  const loaderRadioEls = LOADER_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = root.querySelector(`[data-role="loader-${opt.value}"]`);
    return acc;
  }, {});

  let syncing = false;

  function publish() {
    store.setState({
      selectedLoader: currentLoader(),
      modOptifine: optifineCb.checked,
      modShaderFps: shaderCb.checked,
      modEmbossedBlocks: embossedCb.checked,
      selectedShader: shaderPicker.value || DEFAULT_SHADER_SLUG,
    });
  }

  function updateShaderPickerVisibility() {
    // Shader picker yalnızca Shader+FPS açıkken VE shader satırı bu loader için
    // görünür olduğunda anlamlı. OptiFine seçiliyken Shader+FPS otomatik kapanır.
    const visible = shaderCb.checked && !shaderCb.disabled && shaderRow.style.display !== 'none';
    shaderPickerField.style.display = visible ? '' : 'none';
  }

  function currentLoader() {
    for (const opt of LOADER_OPTIONS) {
      if (loaderRadioEls[opt.value].checked) return opt.value;
    }
    return DEFAULT_LOADER;
  }

  function applyMutualExclusion() {
    if (optifineCb.checked) {
      if (shaderCb.checked) {
        shaderCb.checked = false;
        store.setState({ modShaderFps: false });
      }
      shaderCb.disabled = true;
      shaderCb.title = 'OptiFine seçiliyken Shader + FPS kullanılamaz.';
    } else {
      shaderCb.disabled = !shaderFpsSupported(store.getState().selectedVersion);
      shaderCb.title = shaderCb.disabled
        ? 'Bu seçenek için Minecraft 1.16 veya üstü bir sürüm seçin.'
        : '';
    }
  }

  function applyVersionGates() {
    const state = store.getState();
    const v = state.selectedVersion;
    const isSnapshot = state.selectedVersionType === 'snapshot' ||
      state.selectedVersionType === 'old_beta' ||
      state.selectedVersionType === 'old_alpha';
    const opOk = !isSnapshot && optifineSupported(v);
    const shOk = !isSnapshot && shaderFpsSupported(v);
    const emOk = !isSnapshot && embossedBlocksSupported(v);

    if (isSnapshot) {
      const reason = 'Snapshot/eski sürümlerde mod ekosistemi (Iris, Sodium, Continuity) yayınlanmaz; stable bir sürüm seçin.';
      if (optifineCb.checked) {
        optifineCb.checked = false;
        store.setState({ modOptifine: false });
      }
      if (shaderCb.checked) {
        shaderCb.checked = false;
        store.setState({ modShaderFps: false });
      }
      if (embossedCb.checked) {
        embossedCb.checked = false;
        store.setState({ modEmbossedBlocks: false });
      }
      optifineCb.disabled = true;
      shaderCb.disabled = true;
      embossedCb.disabled = true;
      optifineCb.title = reason;
      shaderCb.title = reason;
      embossedCb.title = reason;
      return;
    }

    optifineCb.disabled = !opOk;
    embossedCb.disabled = !emOk;

    optifineCb.title = opOk
      ? ''
      : 'OptiFine paketi için Minecraft 1.16 veya üstü bir sürüm seçin.';
    embossedCb.title = emOk
      ? ''
      : 'Bu seçenek için Minecraft 1.18 veya üstü bir sürüm seçin (Continuity uyumu).';

    if (!opOk && optifineCb.checked) {
      optifineCb.checked = false;
      store.setState({ modOptifine: false });
    }
    if (!emOk && embossedCb.checked) {
      embossedCb.checked = false;
      store.setState({ modEmbossedBlocks: false });
    }

    applyMutualExclusion();
    updateShaderPickerVisibility();
  }

  // Her loader için hangi mod row'ları görünür ve mods-title:
  const ROWS_BY_LOADER = {
    fabric: {
      rows: ['shaderFps', 'optifine', 'embossed'],
      title: 'Fabric Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + Complementary Reimagined)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity + Sodium)',
    },
    quilt: {
      rows: ['shaderFps'],
      title: 'Quilt Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + Complementary Reimagined)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity)',
    },
    forge: {
      rows: ['shaderFps', 'embossed'],
      title: 'Forge Modları',
      shaderLabel: 'Shader + FPS (Embeddium + Oculus + Complementary Reimagined — ⚠ Mac\'te Oculus OpenGL 1282 hatası verebilir; NeoForge veya Fabric önerilir)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity Forge — sadece 1.20.1)',
    },
    'forge-optifine': {
      rows: ['embossed'],
      title: 'Forge + OptiFine Modları',
      shaderLabel: '',
      embossedLabel: "Kabartmalı / bağlı bloklar (OptiFine içeride zaten CTM destekler — ek mod gerek yok)",
    },
    neoforge: {
      rows: ['shaderFps'],
      title: 'NeoForge Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + Complementary Reimagined)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (NeoForge\'da native Continuity yok — desteklenmiyor)',
    },
    'legacy-fabric': {
      rows: [],
      title: 'Legacy Fabric',
      shaderLabel: '',
      embossedLabel: '',
    },
    vanilla: {
      rows: [],
      title: 'Vanilla',
      shaderLabel: '',
      embossedLabel: '',
    },
  };

  function applyLoaderState() {
    const loader = currentLoader();
    const config = ROWS_BY_LOADER[loader] || ROWS_BY_LOADER.fabric;

    // Row'ları göster/gizle
    const allRows = { shaderFps: shaderRow, optifine: optifineRow, embossed: embossedRow };
    for (const key of Object.keys(allRows)) {
      allRows[key].style.display = config.rows.includes(key) ? '' : 'none';
    }
    // Görünmeyen row'lara karşılık gelen checkbox'ları kapat
    if (!config.rows.includes('shaderFps') && shaderCb.checked) {
      shaderCb.checked = false;
      store.setState({ modShaderFps: false });
    }
    if (!config.rows.includes('optifine') && optifineCb.checked) {
      optifineCb.checked = false;
      store.setState({ modOptifine: false });
    }
    if (!config.rows.includes('embossed') && embossedCb.checked) {
      embossedCb.checked = false;
      store.setState({ modEmbossedBlocks: false });
    }

    modsTitle.textContent = config.title;
    if (config.shaderLabel) shaderLabel.textContent = config.shaderLabel;
    if (config.embossedLabel) embossedLabel.textContent = config.embossedLabel;
    modsOptionsBox.style.display = config.rows.length > 0 ? '' : 'none';

    // Loader hint metni
    if (loader === FABRIC_LOADER) {
      loaderWarning.style.display = 'none';
      loaderWarning.textContent = '';
      return;
    }
    loaderWarning.style.display = '';
    if (loader === 'forge') {
      loaderWarning.textContent =
        'Forge loader otomatik kurulacak. Shader + FPS için Rubidium (Sodium fork) + Oculus (Iris fork) indirilir; en iyi destek Minecraft 1.20.1 ve daha eski sürümlerdedir.';
    } else if (loader === 'neoforge') {
      loaderWarning.textContent =
        'NeoForge (Forge\'un modern çatalı) otomatik kurulacak. Shader + FPS için Iris ve Sodium\'un NeoForge sürümleri indirilir (1.21.2 ve üzeri önerilir).';
    } else if (loader === 'quilt') {
      loaderWarning.textContent =
        'Quilt loader otomatik kurulacak. Shader + FPS Fabric ekosistemiyle çalışır (Iris + Sodium).';
    } else if (loader === 'legacy-fabric') {
      loaderWarning.textContent =
        'Legacy Fabric otomatik kurulacak. Sürüm seçici yalnızca Legacy Fabric\'in desteklediği eski sürümleri (1.3 – 1.13.2 aralığı) gösterir. Modları mods/ klasörüne kendiniz eklersiniz.';
    } else if (loader === 'vanilla') {
      loaderWarning.textContent =
        'Vanilla seçili — Minecraft, Mojang\'ın resmi profiliyle başlar. Hiçbir loader/mod yüklenmez ve mods/ klasörü okunmaz.';
    } else {
      // forge-optifine
      const v = store.getState().selectedVersion;
      if (!forgeOptifineLikelySupported(v)) {
        loaderWarning.textContent =
          `⚠ OptiFine "${v}" sürümünü desteklemiyor. OptiFine en son 1.21.9'a kadar yayınlandı — daha eski bir sürüm seçin veya "Forge" (OptiFine'sız) profilini kullanın.`;
      } else {
        loaderWarning.textContent =
          'Forge + klasik OptiFine.jar otomatik indirilecek. OptiFine kendi shader ve CTM sistemini içerir; ek mod gerekmez.';
      }
    }
    updateShaderPickerVisibility();
  }

  for (const opt of LOADER_OPTIONS) {
    loaderRadioEls[opt.value].addEventListener('change', () => {
      if (syncing) return;
      applyLoaderState();
      publish();
    });
  }

  optifineCb.addEventListener('change', () => {
    if (syncing) return;
    syncing = true;
    applyMutualExclusion();
    updateShaderPickerVisibility();
    publish();
    syncing = false;
  });

  shaderCb.addEventListener('change', () => {
    if (syncing) return;
    if (shaderCb.checked && optifineCb.checked) {
      syncing = true;
      optifineCb.checked = false;
      store.setState({ modOptifine: false });
      applyMutualExclusion();
      syncing = false;
    }
    updateShaderPickerVisibility();
    publish();
  });

  embossedCb.addEventListener('change', publish);
  shaderPicker.addEventListener('change', publish);

  function renderFromStore(state) {
    const loader = state.selectedLoader || DEFAULT_LOADER;
    for (const opt of LOADER_OPTIONS) {
      const should = opt.value === loader;
      if (loaderRadioEls[opt.value].checked !== should) {
        loaderRadioEls[opt.value].checked = should;
      }
    }
    if (optifineCb.checked !== !!state.modOptifine) optifineCb.checked = !!state.modOptifine;
    if (shaderCb.checked !== !!state.modShaderFps) shaderCb.checked = !!state.modShaderFps;
    if (embossedCb.checked !== !!state.modEmbossedBlocks) embossedCb.checked = !!state.modEmbossedBlocks;
    const shader = state.selectedShader || DEFAULT_SHADER_SLUG;
    if (shaderPicker.value !== shader) shaderPicker.value = shader;
    applyLoaderState();
    applyVersionGates();
    updateShaderPickerVisibility();
  }

  function mount() {
    const initial = store.getState();
    const patch = {};
    if (!initial.selectedLoader) patch.selectedLoader = DEFAULT_LOADER;
    if (!initial.selectedShader) patch.selectedShader = DEFAULT_SHADER_SLUG;
    if (Object.keys(patch).length > 0) store.setState(patch);
    renderFromStore(store.getState());
    return store.subscribe((state) => {
      renderFromStore(state);
    });
  }

  return { mount };
}
