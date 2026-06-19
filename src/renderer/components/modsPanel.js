import { isClientMode } from '../../shared/marsanaClient.js';
import {
  shaderFpsSupported,
  embossedBlocksSupported,
  optifineSupported,
  voiceChatSupported,
  fullbrightUbSupported,
  betterLeavesSupported,
  glowingOresSupported,
  roundTreesSupported,
  crops3dSupported,
  schematicFarmSupported,
  schematicFarmBundledAvailable,
  forgeOptifineLikelySupported,
  fabricOptifinePackSupported,
} from '../../shared/versionCompatibility.js';

const LOADER_OPTIONS = [
  { value: 'vanilla' },
  { value: 'bedrock' },
  { value: 'roblox' },
  { value: 'fabric' },
  { value: 'fabric-beta' },
  { value: 'forge' },
  { value: 'forge-optifine' },
  { value: 'neoforge' },
  { value: 'quilt' },
  { value: 'legacy-fabric' },
  { value: 'liteloader' },
  { value: 'nilloader' },
  { value: 'ornithe' },
  { value: 'rift' },
];

const FABRIC_LOADERS = new Set(['fabric', 'fabric-beta']);
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
  { slug: 'potato-shaders',            label: 'Potato Shaders' },
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
  { slug: 'lite-shaders',              label: 'E-LITE Shaders (deneysel)' },
  { slug: 'clarityshader',             label: 'Clarity' },
];
const DEFAULT_SHADER_SLUG = 'complementary-reimagined';

export function createModsPanel({ root, store, i18n }) {
  const loaderRadios = LOADER_OPTIONS.map(
    (opt) => `
      <div class="loader-option">
        <label class="field radio">
          <input type="radio" name="loader" value="${opt.value}" data-role="loader-${opt.value}" />
          <span></span>
        </label>
        <p class="hint mods-hint" data-role="hint-loader-${opt.value}"></p>
      </div>
    `
  ).join('');

  root.innerHTML = `
    <h3 class="section-title" data-role="loader-section-title">Mod Yükleyici</h3>
    <div class="loader-grid" data-role="loader-grid">
      ${loaderRadios}
    </div>

    <div class="mods-options" data-role="mods-options">
      <h3 class="section-title mods-options-heading" data-role="mods-title">Mod Seçenekleri</h3>

      <div class="mods-options-grid">
        <div class="mods-options-col">
          <div data-role="row-shaderFps">
            <label class="field checkbox">
              <input type="checkbox" data-role="shaderFps" />
              <span data-role="label-shaderFps">Shader + FPS</span>
            </label>
            <p class="hint mods-hint" data-role="hint-shader">
              Gerçekçi ışık ve gölgeler; en akıcı oyun için oyunda shader paketinde <strong>Performance</strong> profilini seçin.
            </p>
            <div class="shader-picker-block" data-role="shader-picker-block" style="display:none;">
              <label class="field">
                <span>Shader paketi</span>
                <select data-role="shader-picker">
                  ${SHADER_OPTIONS.map(
                    (o) => `<option value="${o.slug}">${o.label}</option>`
                  ).join('')}
                </select>
              </label>
              <p class="hint mods-hint" data-role="hint-shader-picker">
                Shader + FPS açıkken seçilen paket otomatik indirilir ve oyunda etkinleştirilir.
              </p>
            </div>
          </div>
        </div>

        <div class="mods-options-col">
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

          <div data-role="row-voiceChat">
            <label class="field checkbox">
              <input type="checkbox" data-role="voiceChat" />
              <span>Voice Chat (Simple Voice Chat)</span>
            </label>
            <p class="hint mods-hint" data-role="hint-voiceChat">
              Proximity sesli sohbet; oyunda <strong>V</strong> ile ayarlanır. Çok oyunculu sunucuda mod gerekir.
            </p>
          </div>

          <div data-role="row-fullbrightUb">
            <label class="field checkbox">
              <input type="checkbox" data-role="fullbrightUb" />
              <span>Fullbright UB</span>
            </label>
            <p class="hint mods-hint" data-role="hint-fullbrightUb">
              Karanlıkta tam parlaklık kaynak paketi; <strong>Vanilla</strong>, <strong>OptiFine</strong> ve <strong>Sodium/Iris</strong> ile uyumludur. Shader + Sodium seçiliyken PolyTone otomatik eklenir.
            </p>
          </div>

          <div data-role="row-betterLeaves">
            <label class="field checkbox">
              <input type="checkbox" data-role="betterLeaves" />
              <span>Motschen's Better Leaves</span>
            </label>
            <p class="hint mods-hint" data-role="hint-betterLeaves">
              Yaprakları daha gür ve doğal gösterir. <strong>Fabric/Forge/NeoForge</strong> ile <strong>Cull Leaves</strong> otomatik eklenir;
              yalnızca <strong>Vanilla</strong> seçiliyse etki sınırlıdır. OptiFine'da <strong>Smart Leaves</strong> açın.
            </p>
          </div>

          <div data-role="row-glowingOres">
            <label class="field checkbox">
              <input type="checkbox" data-role="glowingOres" />
              <span>New Glowing Ores</span>
            </label>
            <p class="hint mods-hint" data-role="hint-glowingOres">
              Madenleri parlatır ve bağlı çerçeve ekler; mod desteği mevcuttur. Fabric/Quilt/Forge için <strong>Continuity</strong> otomatik eklenir; OptiFine'da <strong>Emissive Textures</strong> açın.
            </p>
          </div>

          <div data-role="row-roundTrees">
            <label class="field checkbox">
              <input type="checkbox" data-role="roundTrees" />
              <span>Round Trees</span>
            </label>
            <p class="hint mods-hint" data-role="hint-roundTrees">
              Ağaç gövdelerini yuvarlak gösterir; Vanilla+ görünüm. Ek mod gerekmez; diğer kaynak paketlerinin <strong>üstünde</strong> otomatik etkinleştirilir.
            </p>
          </div>

          <div data-role="row-schematicFarm">
            <label class="field checkbox">
              <input type="checkbox" data-role="schematicFarm" />
              <span data-role="label-schematicFarm">Sematik Farm Modu (Marsana)</span>
            </label>
            <p class="hint mods-hint" data-role="hint-schematicFarm">
              F8 — mob, bambu, demir ve şeker kamışı farm şablonları; blok var/gerekli/eksik sayacı. Fabric gerekir.
            </p>
          </div>

          <div data-role="row-crops3d">
            <label class="field checkbox">
              <input type="checkbox" data-role="crops3d" />
              <span>3D crops Revamped</span>
            </label>
            <p class="hint mods-hint" data-role="hint-crops3d">
              Buğday, patates, havuç ve diğer tarım bloklarını 3D modellere çevirir. Hafif kaynak paketi; Vanilla stiline yakın kalır.
            </p>
          </div>
        </div>
      </div>
    </div>

    <p class="hint mods-footnote" data-role="loader-warning" style="display:none;"></p>
  `;

  const optifineCb = root.querySelector('[data-role="optifine"]');
  const shaderCb = root.querySelector('[data-role="shaderFps"]');
  const embossedCb = root.querySelector('[data-role="embossed"]');
  const voiceChatCb = root.querySelector('[data-role="voiceChat"]');
  const fullbrightUbCb = root.querySelector('[data-role="fullbrightUb"]');
  const betterLeavesCb = root.querySelector('[data-role="betterLeaves"]');
  const glowingOresCb = root.querySelector('[data-role="glowingOres"]');
  const roundTreesCb = root.querySelector('[data-role="roundTrees"]');
  const crops3dCb = root.querySelector('[data-role="crops3d"]');
  const schematicFarmCb = root.querySelector('[data-role="schematicFarm"]');
  const optifineRow = root.querySelector('[data-role="row-optifine"]');
  const shaderRow = root.querySelector('[data-role="row-shaderFps"]');
  const embossedRow = root.querySelector('[data-role="row-embossed"]');
  const voiceChatRow = root.querySelector('[data-role="row-voiceChat"]');
  const fullbrightUbRow = root.querySelector('[data-role="row-fullbrightUb"]');
  const betterLeavesRow = root.querySelector('[data-role="row-betterLeaves"]');
  const glowingOresRow = root.querySelector('[data-role="row-glowingOres"]');
  const roundTreesRow = root.querySelector('[data-role="row-roundTrees"]');
  const crops3dRow = root.querySelector('[data-role="row-crops3d"]');
  const schematicFarmRow = root.querySelector('[data-role="row-schematicFarm"]');
  const shaderLabel = root.querySelector('[data-role="label-shaderFps"]');
  const embossedLabel = root.querySelector('[data-role="label-embossed"]');
  const shaderPickerBlock = root.querySelector('[data-role="shader-picker-block"]');
  const shaderPicker = root.querySelector('[data-role="shader-picker"]');
  const hintShaderPicker = root.querySelector('[data-role="hint-shader-picker"]');
  const modsTitle = root.querySelector('[data-role="mods-title"]');
  const modsOptionsBox = root.querySelector('[data-role="mods-options"]');
  const modsOptionsGrid = root.querySelector('.mods-options-grid');
  const modsOptionsColRight = root.querySelector('.mods-options-col:last-child');
  const loaderWarning = root.querySelector('[data-role="loader-warning"]');
  const loaderGrid = root.querySelector('[data-role="loader-grid"]');
  const loaderSectionTitle = root.querySelector('[data-role="loader-section-title"]');
  const loaderRadioEls = LOADER_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = root.querySelector(`[data-role="loader-${opt.value}"]`);
    return acc;
  }, {});

  let syncing = false;

  function modT(key, params) {
    return i18n.t(`mods.${key}`, params);
  }

  function publish() {
    store.setState({
      selectedLoader: currentLoader(),
      modOptifine: optifineCb.checked,
      modShaderFps: shaderCb.checked,
      modEmbossedBlocks: embossedCb.checked,
      modVoiceChat: voiceChatCb.checked,
      modFullbrightUb: fullbrightUbCb.checked,
      modBetterLeaves: betterLeavesCb.checked,
      modGlowingOres: glowingOresCb.checked,
      modRoundTrees: roundTreesCb.checked,
      modCrops3d: crops3dCb.checked,
      modSchematicFarm: schematicFarmCb.checked,
      selectedShader: shaderPicker.value || DEFAULT_SHADER_SLUG,
    });
  }

  const SHADER_PICKER_LOADERS = new Set(['fabric', 'fabric-beta', 'quilt', 'forge', 'neoforge']);

  function updateShaderPickerVisibility() {
    const loader = currentLoader();
    const loaderSupportsShaderFps = shaderRow.style.display !== 'none';

    shaderPickerBlock.style.display = loaderSupportsShaderFps ? '' : 'none';

    const active = loaderSupportsShaderFps && shaderCb.checked && !shaderCb.disabled;
    shaderPicker.disabled = !active;
    shaderPicker.title = active ? '' : modT('shaderPickerDisabledTitle');

    if (hintShaderPicker) {
      if (SHADER_PICKER_LOADERS.has(loader)) {
        hintShaderPicker.textContent = modT(`shaderPickerHints.${loader}`);
      } else {
        hintShaderPicker.textContent = modT('shaderPackHint');
      }
    }
  }

  function applyMutualExclusion() {
    if (optifineCb.checked) {
      if (shaderCb.checked) {
        shaderCb.checked = false;
        store.setState({ modShaderFps: false });
      }
      shaderCb.disabled = true;
      shaderCb.title = modT('shaderBlockedByOptifine');
    } else {
      shaderCb.disabled = !shaderFpsSupported(store.getState().selectedVersion);
      shaderCb.title = shaderCb.disabled ? modT('shaderNeedsVersion') : '';
    }
  }

  function currentLoader() {
    for (const opt of LOADER_OPTIONS) {
      if (loaderRadioEls[opt.value].checked) return opt.value;
    }
    return DEFAULT_LOADER;
  }

  function applyVersionGates() {
    const state = store.getState();
    const v = state.selectedVersion;
    const isSnapshot = state.selectedVersionType === 'snapshot' ||
      state.selectedVersionType === 'old_beta' ||
      state.selectedVersionType === 'old_alpha';
    const opOk = !isSnapshot && optifineSupported(v) && fabricOptifinePackSupported(v);
    const shOk = !isSnapshot && shaderFpsSupported(v);
    const emOk = !isSnapshot && embossedBlocksSupported(v);
    const vcOk = !isSnapshot && voiceChatSupported(v);
    const fbOk = !isSnapshot && fullbrightUbSupported(v);
    const blOk = !isSnapshot && betterLeavesSupported(v);
    const goOk = !isSnapshot && glowingOresSupported(v);
    const rtOk = !isSnapshot && roundTreesSupported(v);
    const c3Ok = !isSnapshot && crops3dSupported(v);
    const sfOk = !isSnapshot && schematicFarmSupported(v) && schematicFarmBundledAvailable(v);

    if (isSnapshot) {
      const reason = modT('tooltips.snapshot');
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
      if (voiceChatCb.checked) {
        voiceChatCb.checked = false;
        store.setState({ modVoiceChat: false });
      }
      if (fullbrightUbCb.checked) {
        fullbrightUbCb.checked = false;
        store.setState({ modFullbrightUb: false });
      }
      if (betterLeavesCb.checked) {
        betterLeavesCb.checked = false;
        store.setState({ modBetterLeaves: false });
      }
      if (glowingOresCb.checked) {
        glowingOresCb.checked = false;
        store.setState({ modGlowingOres: false });
      }
      if (roundTreesCb.checked) {
        roundTreesCb.checked = false;
        store.setState({ modRoundTrees: false });
      }
      if (crops3dCb.checked) {
        crops3dCb.checked = false;
        store.setState({ modCrops3d: false });
      }
      if (schematicFarmCb.checked) {
        schematicFarmCb.checked = false;
        store.setState({ modSchematicFarm: false });
      }
      optifineCb.disabled = true;
      shaderCb.disabled = true;
      embossedCb.disabled = true;
      voiceChatCb.disabled = true;
      fullbrightUbCb.disabled = true;
      betterLeavesCb.disabled = true;
      glowingOresCb.disabled = true;
      roundTreesCb.disabled = true;
      crops3dCb.disabled = true;
      schematicFarmCb.disabled = true;
      optifineCb.title = reason;
      shaderCb.title = reason;
      embossedCb.title = reason;
      voiceChatCb.title = reason;
      fullbrightUbCb.title = reason;
      betterLeavesCb.title = reason;
      glowingOresCb.title = reason;
      roundTreesCb.title = reason;
      crops3dCb.title = reason;
      schematicFarmCb.title = reason;
      return;
    }

    optifineCb.disabled = !opOk;
    embossedCb.disabled = !emOk;
    voiceChatCb.disabled = !vcOk;
    fullbrightUbCb.disabled = !fbOk;
    betterLeavesCb.disabled = !blOk;
    glowingOresCb.disabled = !goOk;
    roundTreesCb.disabled = !rtOk;
    crops3dCb.disabled = !c3Ok;
    schematicFarmCb.disabled = !sfOk;

    optifineCb.title = opOk ? '' : modT('tooltips.optifineVersion');
    const hintOptifine = root.querySelector('[data-role="hint-optifine"]');
    if (hintOptifine) {
      if (opOk && /^26\.2/.test(String(v || ''))) {
        hintOptifine.textContent = modT('optifineHint26_2');
      } else if (opOk && /^26\./.test(String(v || ''))) {
        hintOptifine.textContent = modT('optifineHint26');
      } else {
        hintOptifine.textContent = modT('optifineHint');
      }
    }
    embossedCb.title = emOk ? '' : modT('tooltips.embossedVersion');
    voiceChatCb.title = vcOk ? '' : modT('tooltips.voiceChatVersion');
    fullbrightUbCb.title = fbOk ? '' : modT('tooltips.fullbrightUnsupported');
    betterLeavesCb.title = blOk ? '' : modT('tooltips.betterLeavesUnsupported');
    glowingOresCb.title = goOk ? '' : modT('tooltips.glowingOresVersion');
    roundTreesCb.title = rtOk ? '' : modT('tooltips.roundTreesUnsupported');
    crops3dCb.title = c3Ok ? '' : modT('tooltips.crops3dUnsupported');
    schematicFarmCb.title = sfOk ? '' : modT('tooltips.schematicFarmVersion');

    if (!opOk && optifineCb.checked) {
      optifineCb.checked = false;
      store.setState({ modOptifine: false });
    }
    if (!emOk && embossedCb.checked) {
      embossedCb.checked = false;
      store.setState({ modEmbossedBlocks: false });
    }
    if (!vcOk && voiceChatCb.checked) {
      voiceChatCb.checked = false;
      store.setState({ modVoiceChat: false });
    }
    if (!fbOk && fullbrightUbCb.checked) {
      fullbrightUbCb.checked = false;
      store.setState({ modFullbrightUb: false });
    }
    if (!blOk && betterLeavesCb.checked) {
      betterLeavesCb.checked = false;
      store.setState({ modBetterLeaves: false });
    }
    if (!goOk && glowingOresCb.checked) {
      glowingOresCb.checked = false;
      store.setState({ modGlowingOres: false });
    }
    if (!rtOk && roundTreesCb.checked) {
      roundTreesCb.checked = false;
      store.setState({ modRoundTrees: false });
    }
    if (!c3Ok && crops3dCb.checked) {
      crops3dCb.checked = false;
      store.setState({ modCrops3d: false });
    }
    if (!sfOk && schematicFarmCb.checked) {
      schematicFarmCb.checked = false;
      store.setState({ modSchematicFarm: false });
    }

    applyMutualExclusion();
    updateShaderPickerVisibility();
  }

  const ROWS_BY_LOADER = {
    fabric: {
      rows: ['shaderFps', 'optifine', 'embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'schematicFarm', 'crops3d'],
      titleKey: 'titles.fabric',
      shaderLabelKey: 'shaderLabels.fabric',
      embossedLabelKey: 'embossedLabels.fabric',
    },
    'fabric-beta': {
      rows: ['shaderFps', 'optifine', 'embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'schematicFarm', 'crops3d'],
      titleKey: 'titles.fabric-beta',
      shaderLabelKey: 'shaderLabels.fabric-beta',
      embossedLabelKey: 'embossedLabels.fabric-beta',
    },
    quilt: {
      rows: ['shaderFps', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      titleKey: 'titles.quilt',
      shaderLabelKey: 'shaderLabels.quilt',
      embossedLabelKey: 'embossedLabels.quilt',
    },
    forge: {
      rows: ['shaderFps', 'embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      titleKey: 'titles.forge',
      shaderLabelKey: 'shaderLabels.forge',
      embossedLabelKey: 'embossedLabels.forge',
    },
    'forge-optifine': {
      rows: ['embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      titleKey: 'titles.forge-optifine',
      shaderLabelKey: null,
      embossedLabelKey: 'embossedLabels.forge-optifine',
    },
    neoforge: {
      rows: ['shaderFps', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      titleKey: 'titles.neoforge',
      shaderLabelKey: 'shaderLabels.neoforge',
      embossedLabelKey: 'embossedLabels.neoforge',
    },
    'legacy-fabric': {
      rows: [],
      titleKey: 'titles.legacy-fabric',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    liteloader: {
      rows: [],
      titleKey: 'titles.liteloader',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    nilloader: {
      rows: [],
      titleKey: 'titles.nilloader',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    ornithe: {
      rows: [],
      titleKey: 'titles.ornithe',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    rift: {
      rows: [],
      titleKey: 'titles.rift',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    vanilla: {
      rows: ['fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      titleKey: 'titles.vanilla',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    bedrock: {
      rows: [],
      titleKey: 'titles.bedrock',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
    roblox: {
      rows: [],
      titleKey: 'titles.roblox',
      shaderLabelKey: null,
      embossedLabelKey: null,
    },
  };

  const LOADER_WARNING_KEYS = {
    forge: 'loaderWarnings.forge',
    neoforge: 'loaderWarnings.neoforge',
    quilt: 'loaderWarnings.quilt',
    'legacy-fabric': 'loaderWarnings.legacy-fabric',
    liteloader: 'loaderWarnings.liteloader',
    nilloader: 'loaderWarnings.nilloader',
    ornithe: 'loaderWarnings.ornithe',
    rift: 'loaderWarnings.rift',
    vanilla: 'loaderWarnings.vanilla',
    bedrock: 'loaderWarnings.bedrock',
    roblox: 'loaderWarnings.roblox',
  };

  function applyLoaderState() {
    const loader = currentLoader();
    const config = ROWS_BY_LOADER[loader] || ROWS_BY_LOADER.fabric;

    // Row'ları göster/gizle
    const allRows = {
      shaderFps: shaderRow,
      optifine: optifineRow,
      embossed: embossedRow,
      voiceChat: voiceChatRow,
      fullbrightUb: fullbrightUbRow,
      betterLeaves: betterLeavesRow,
      glowingOres: glowingOresRow,
      roundTrees: roundTreesRow,
      crops3d: crops3dRow,
      schematicFarm: schematicFarmRow,
    };
    for (const key of Object.keys(allRows)) {
      allRows[key].style.display = config.rows.includes(key) ? '' : 'none';
    }

    const rightColVisible =
      config.rows.includes('optifine') ||
      config.rows.includes('embossed') ||
      config.rows.includes('voiceChat') ||
      config.rows.includes('fullbrightUb') ||
      config.rows.includes('betterLeaves') ||
      config.rows.includes('glowingOres') ||
      config.rows.includes('roundTrees') ||
      config.rows.includes('crops3d') ||
      config.rows.includes('schematicFarm');
    if (modsOptionsColRight) {
      modsOptionsColRight.style.display = rightColVisible ? '' : 'none';
    }
    if (modsOptionsGrid) {
      modsOptionsGrid.style.gridTemplateColumns = rightColVisible ? '' : '1fr';
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
    if (!config.rows.includes('voiceChat') && voiceChatCb.checked) {
      voiceChatCb.checked = false;
      store.setState({ modVoiceChat: false });
    }
    if (!config.rows.includes('fullbrightUb') && fullbrightUbCb.checked) {
      fullbrightUbCb.checked = false;
      store.setState({ modFullbrightUb: false });
    }
    if (!config.rows.includes('betterLeaves') && betterLeavesCb.checked) {
      betterLeavesCb.checked = false;
      store.setState({ modBetterLeaves: false });
    }
    if (!config.rows.includes('glowingOres') && glowingOresCb.checked) {
      glowingOresCb.checked = false;
      store.setState({ modGlowingOres: false });
    }
    if (!config.rows.includes('roundTrees') && roundTreesCb.checked) {
      roundTreesCb.checked = false;
      store.setState({ modRoundTrees: false });
    }
    if (!config.rows.includes('crops3d') && crops3dCb.checked) {
      crops3dCb.checked = false;
      store.setState({ modCrops3d: false });
    }
    if (!config.rows.includes('schematicFarm') && schematicFarmCb.checked) {
      schematicFarmCb.checked = false;
      store.setState({ modSchematicFarm: false });
    }

    modsTitle.textContent = modT(config.titleKey);
    if (config.shaderLabelKey) {
      const shaderText = modT(config.shaderLabelKey);
      if (shaderText) shaderLabel.textContent = shaderText;
    }
    if (config.embossedLabelKey) {
      const embossedText = modT(config.embossedLabelKey);
      if (embossedText) embossedLabel.textContent = embossedText;
    }
    modsOptionsBox.style.display = config.rows.length > 0 ? '' : 'none';

    if (FABRIC_LOADERS.has(loader)) {
      loaderWarning.style.display = 'none';
      loaderWarning.textContent = '';
    } else {
      loaderWarning.style.display = '';
      if (loader === 'forge-optifine') {
        const v = store.getState().selectedVersion;
        if (!forgeOptifineLikelySupported(v)) {
          loaderWarning.textContent = modT('loaderWarnings.forgeOptifineUnsupported', { version: v });
        } else {
          loaderWarning.textContent = modT('loaderWarnings.forgeOptifineOk');
        }
      } else {
        const warnKey = LOADER_WARNING_KEYS[loader];
        loaderWarning.textContent = warnKey ? modT(warnKey) : '';
        if (!warnKey) {
          loaderWarning.style.display = 'none';
        }
      }
    }
    const bedrockOnly = !!store.getState().user?.bedrockOnly;
    for (const opt of LOADER_OPTIONS) {
      const el = loaderRadioEls[opt.value];
      if (!el) continue;
      const allowed = !bedrockOnly || opt.value === 'bedrock';
      el.disabled = !allowed;
      const optionWrap = el.closest('.loader-option');
      if (optionWrap) optionWrap.style.opacity = allowed ? '' : '0.45';
    }
    updateShaderPickerVisibility();
  }

  for (const opt of LOADER_OPTIONS) {
    loaderRadioEls[opt.value].addEventListener('change', () => {
      if (syncing) return;
      applyLoaderState();
      applyVersionGates();
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
  voiceChatCb.addEventListener('change', publish);
  fullbrightUbCb.addEventListener('change', publish);
  betterLeavesCb.addEventListener('change', publish);
  glowingOresCb.addEventListener('change', publish);
  roundTreesCb.addEventListener('change', publish);
  crops3dCb.addEventListener('change', publish);
  schematicFarmCb.addEventListener('change', publish);
  shaderPicker.addEventListener('change', publish);

  function applyPlayModeVisibility(state) {
    const client = isClientMode(state.playMode);
    const hide = client ? 'none' : '';
    if (loaderSectionTitle) loaderSectionTitle.style.display = hide;
    if (loaderGrid) loaderGrid.style.display = hide;
    if (modsOptionsBox) {
      modsOptionsBox.style.display = client
        ? 'none'
        : (ROWS_BY_LOADER[currentLoader()] || ROWS_BY_LOADER.fabric).rows.length > 0
          ? ''
          : 'none';
    }
    if (loaderWarning && client) loaderWarning.style.display = 'none';
  }

  function applyModsI18n() {
    const t = i18n.t;
    if (loaderSectionTitle) loaderSectionTitle.textContent = t('mods.loaderSection');
    if (modsTitle) modsTitle.textContent = t('mods.modOptions');
    for (const opt of LOADER_OPTIONS) {
      const labelSpan = loaderRadioEls[opt.value]?.closest('label')?.querySelector('span');
      const hint = root.querySelector(`[data-role="hint-loader-${opt.value}"]`);
      if (labelSpan) labelSpan.textContent = t(`loaders.${opt.value}.label`);
      if (hint) hint.textContent = t(`loaders.${opt.value}.hint`);
    }
    const hintShader = root.querySelector('[data-role="hint-shader"]');
    if (hintShader) hintShader.textContent = t('mods.shaderFpsHint');
    const shaderPackLabel = shaderPickerBlock?.querySelector('label.field > span');
    if (shaderPackLabel) shaderPackLabel.textContent = t('mods.shaderPack');
    const optifineSpan = root.querySelector('[data-role="row-optifine"] label span');
    if (optifineSpan) optifineSpan.textContent = t('mods.optifine');
    const hintEmbossed = root.querySelector('[data-role="hint-embossed"]');
    if (hintEmbossed) hintEmbossed.textContent = t('mods.embossedHint');
    const voiceSpan = root.querySelector('[data-role="row-voiceChat"] label span');
    if (voiceSpan) voiceSpan.textContent = t('mods.voiceChat');
    const hintVoice = root.querySelector('[data-role="hint-voiceChat"]');
    if (hintVoice) hintVoice.textContent = t('mods.voiceChatHint');
    const fullbrightSpan = root.querySelector('[data-role="row-fullbrightUb"] label span');
    if (fullbrightSpan) fullbrightSpan.textContent = t('mods.fullbrightUb');
    const hintFullbright = root.querySelector('[data-role="hint-fullbrightUb"]');
    if (hintFullbright) hintFullbright.textContent = t('mods.fullbrightUbHint');
    const leavesSpan = root.querySelector('[data-role="row-betterLeaves"] label span');
    if (leavesSpan) leavesSpan.textContent = t('mods.betterLeaves');
    const hintLeaves = root.querySelector('[data-role="hint-betterLeaves"]');
    if (hintLeaves) hintLeaves.textContent = t('mods.betterLeavesHint');
    const oresSpan = root.querySelector('[data-role="row-glowingOres"] label span');
    if (oresSpan) oresSpan.textContent = t('mods.glowingOres');
    const hintOres = root.querySelector('[data-role="hint-glowingOres"]');
    if (hintOres) hintOres.textContent = t('mods.glowingOresHint');
    const treesSpan = root.querySelector('[data-role="row-roundTrees"] label span');
    if (treesSpan) treesSpan.textContent = t('mods.roundTrees');
    const hintTrees = root.querySelector('[data-role="hint-roundTrees"]');
    if (hintTrees) hintTrees.textContent = t('mods.roundTreesHint');
    const cropsSpan = root.querySelector('[data-role="row-crops3d"] label span');
    if (cropsSpan) cropsSpan.textContent = t('mods.crops3d');
    const hintCrops = root.querySelector('[data-role="hint-crops3d"]');
    if (hintCrops) hintCrops.textContent = t('mods.crops3dHint');
    const schematicSpan = root.querySelector('[data-role="row-schematicFarm"] label span');
    if (schematicSpan) schematicSpan.textContent = t('mods.schematicFarm');
    const hintSchematic = root.querySelector('[data-role="hint-schematicFarm"]');
    if (hintSchematic) hintSchematic.textContent = t('mods.schematicFarmHint');
    if (shaderLabel) {
      const loader = currentLoader();
      const config = ROWS_BY_LOADER[loader] || ROWS_BY_LOADER.fabric;
      if (config.shaderLabelKey) {
        const shaderText = modT(config.shaderLabelKey);
        if (shaderText) shaderLabel.textContent = shaderText;
      } else {
        shaderLabel.textContent = t('mods.shaderFps');
      }
    }
    if (embossedLabel) {
      const loader = currentLoader();
      const config = ROWS_BY_LOADER[loader] || ROWS_BY_LOADER.fabric;
      if (config.embossedLabelKey) {
        const embossedText = modT(config.embossedLabelKey);
        if (embossedText) embossedLabel.textContent = embossedText;
      } else {
        embossedLabel.textContent = t('mods.embossed');
      }
    }
    applyLoaderState();
    applyVersionGates();
    updateShaderPickerVisibility();
  }

  applyModsI18n();

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
    if (voiceChatCb.checked !== !!state.modVoiceChat) voiceChatCb.checked = !!state.modVoiceChat;
    if (fullbrightUbCb.checked !== !!state.modFullbrightUb) fullbrightUbCb.checked = !!state.modFullbrightUb;
    if (betterLeavesCb.checked !== !!state.modBetterLeaves) betterLeavesCb.checked = !!state.modBetterLeaves;
    if (glowingOresCb.checked !== !!state.modGlowingOres) glowingOresCb.checked = !!state.modGlowingOres;
    if (roundTreesCb.checked !== !!state.modRoundTrees) roundTreesCb.checked = !!state.modRoundTrees;
    if (crops3dCb.checked !== !!state.modCrops3d) crops3dCb.checked = !!state.modCrops3d;
    if (schematicFarmCb.checked !== !!state.modSchematicFarm) schematicFarmCb.checked = !!state.modSchematicFarm;
    const shader = state.selectedShader || DEFAULT_SHADER_SLUG;
    if (shaderPicker.value !== shader) shaderPicker.value = shader;
    applyLoaderState();
    applyVersionGates();
    updateShaderPickerVisibility();
    applyPlayModeVisibility(state);
  }

  function modsStoreKey(state) {
    return [
      state.selectedLoader,
      state.playMode,
      state.selectedVersion,
      state.selectedVersionType,
      state.modOptifine,
      state.modShaderFps,
      state.modEmbossedBlocks,
      state.modVoiceChat,
      state.modFullbrightUb,
      state.modBetterLeaves,
      state.modGlowingOres,
      state.modRoundTrees,
      state.modCrops3d,
      state.modSchematicFarm,
      state.selectedShader,
      state.user?.bedrockOnly ? '1' : '0',
    ].join('\0');
  }

  function mount() {
    const initial = store.getState();
    const patch = {};
    if (!initial.selectedLoader) patch.selectedLoader = DEFAULT_LOADER;
    if (!initial.selectedShader) patch.selectedShader = DEFAULT_SHADER_SLUG;
    if (Object.keys(patch).length > 0) store.setState(patch);
    renderFromStore(store.getState());
    let lastModsKey = modsStoreKey(store.getState());
    const unsubs = [
      store.subscribe((state) => {
        const key = modsStoreKey(state);
        if (key === lastModsKey) return;
        lastModsKey = key;
        renderFromStore(state);
      }),
      i18n.onChange(applyModsI18n),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
