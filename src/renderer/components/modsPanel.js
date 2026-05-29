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
  forgeOptifineLikelySupported,
} from '../../shared/versionCompatibility.js';

const LOADER_OPTIONS = [
  { value: 'vanilla', label: 'Vanilla', hint: 'Saf Minecraft — hiçbir loader veya mod yüklenmez. Mojang\'ın resmi sürümü olduğu gibi başlar.' },
  { value: 'bedrock', label: 'Bedrock (Windows)', hint: 'Minecraft for Windows (Microsoft Store). Marsana hesabı gerekmez; oyun açıldıktan sonra Microsoft/Xbox ile giriş yaparsınız. Java modları uygulanmaz.' },
  { value: 'fabric', label: 'Fabric', hint: 'Modrinth modları (Sodium, Iris, OptiFine for Fabric, vs.). Aşağıdaki seçenekler aktif olur.' },
  { value: 'fabric-beta', label: 'Fabric (Beta)', hint: 'Fabric\'in beta kanalı yükleyicisi. Mod seçenekleri Fabric ile aynıdır; kararlı sürüm yerine beta loader kullanılır.' },
  { value: 'forge', label: 'Forge', hint: 'Klasik Forge loader (boş profil). Modlarınızı mods/ klasörüne kendiniz eklersiniz.' },
  { value: 'forge-optifine', label: 'Forge + OptiFine', hint: 'Forge loader + optifine.net’ten klasik OptiFine.jar otomatik indirilir.' },
  { value: 'neoforge', label: 'NeoForge', hint: 'Forge’un modern çatalı (1.20.2+). Boş profil; modlarınızı mods/ klasörüne kendiniz eklersiniz.' },
  { value: 'quilt', label: 'Quilt', hint: 'Fabric’in çatalı; çoğu Fabric modu Quilt ile uyumludur. Boş profil olarak başlar.' },
  { value: 'legacy-fabric', label: 'Legacy Fabric', hint: 'Eski Minecraft sürümleri (1.3 – 1.13.2) için Fabric çatalı. Sürüm listesi otomatik filtrelenir; boş profil olarak başlar.' },
  { value: 'liteloader', label: 'LiteLoader', hint: 'Klasik LiteLoader (1.6 – 1.12). Sürüm listesi desteklenen sürümlerle filtrelenir; modları mods/ klasörüne kendiniz eklersiniz.' },
  { value: 'nilloader', label: 'NilLoader', hint: 'Vanilla üzerine Java agent olarak eklenen hafif mod loader. Tüm vanilla sürümlerinde çalışır; modları mods/ klasörüne kendiniz eklersiniz.' },
  { value: 'ornithe', label: 'Ornithe (deneysel)', hint: 'Ornithe 0.1.2 şu an dünya/sunucuya girerken çökebiliyor. 1.12.2 modları için Legacy Fabric önerilir.' },
  { value: 'rift', label: 'Rift (deneysel)', hint: 'Minecraft 1.13 / 1.13.2 için eski mod loader. dimdev.org kapalı; topluluk yansısı kullanılır. Fabric önerilir.' },
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
      <div class="loader-option">
        <label class="field radio">
          <input type="radio" name="loader" value="${opt.value}" data-role="loader-${opt.value}" />
          <span>${opt.label}</span>
        </label>
        <p class="hint mods-hint" data-role="hint-loader-${opt.value}">${opt.hint}</p>
      </div>
    `
  ).join('');

  root.innerHTML = `
    <h3 class="section-title">Mod Yükleyici</h3>
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
  const optifineRow = root.querySelector('[data-role="row-optifine"]');
  const shaderRow = root.querySelector('[data-role="row-shaderFps"]');
  const embossedRow = root.querySelector('[data-role="row-embossed"]');
  const voiceChatRow = root.querySelector('[data-role="row-voiceChat"]');
  const fullbrightUbRow = root.querySelector('[data-role="row-fullbrightUb"]');
  const betterLeavesRow = root.querySelector('[data-role="row-betterLeaves"]');
  const glowingOresRow = root.querySelector('[data-role="row-glowingOres"]');
  const roundTreesRow = root.querySelector('[data-role="row-roundTrees"]');
  const crops3dRow = root.querySelector('[data-role="row-crops3d"]');
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
      modVoiceChat: voiceChatCb.checked,
      modFullbrightUb: fullbrightUbCb.checked,
      modBetterLeaves: betterLeavesCb.checked,
      modGlowingOres: glowingOresCb.checked,
      modRoundTrees: roundTreesCb.checked,
      modCrops3d: crops3dCb.checked,
      selectedShader: shaderPicker.value || DEFAULT_SHADER_SLUG,
    });
  }

  const SHADER_PICKER_HINTS = {
    fabric: 'Fabric: Iris + Sodium ile seçilen paket otomatik kurulur ve oyunda etkinleştirilir.',
    'fabric-beta': 'Fabric (Beta): Iris + Sodium ile seçilen paket otomatik kurulur ve oyunda etkinleştirilir.',
    quilt: 'Quilt: Iris + Sodium ile seçilen paket otomatik kurulur ve oyunda etkinleştirilir.',
    forge: 'Forge: Oculus + Rubidium ile seçilen paket otomatik kurulur (Oculus ayarlarına yazılır).',
    neoforge: 'NeoForge: Iris + Sodium ile seçilen paket otomatik kurulur.',
  };

  function updateShaderPickerVisibility() {
    const loader = currentLoader();
    const loaderSupportsShaderFps = shaderRow.style.display !== 'none';

    shaderPickerBlock.style.display = loaderSupportsShaderFps ? '' : 'none';

    const active = loaderSupportsShaderFps && shaderCb.checked && !shaderCb.disabled;
    shaderPicker.disabled = !active;
    shaderPicker.title = active
      ? ''
      : 'Shader paketi seçmek için Shader + FPS seçeneğini işaretleyin.';

    if (hintShaderPicker && SHADER_PICKER_HINTS[loader]) {
      hintShaderPicker.textContent = SHADER_PICKER_HINTS[loader];
    }
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
    const vcOk = !isSnapshot && voiceChatSupported(v);
    const fbOk = !isSnapshot && fullbrightUbSupported(v);
    const blOk = !isSnapshot && betterLeavesSupported(v);
    const goOk = !isSnapshot && glowingOresSupported(v);
    const rtOk = !isSnapshot && roundTreesSupported(v);
    const c3Ok = !isSnapshot && crops3dSupported(v);

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
      optifineCb.disabled = true;
      shaderCb.disabled = true;
      embossedCb.disabled = true;
      voiceChatCb.disabled = true;
      fullbrightUbCb.disabled = true;
      betterLeavesCb.disabled = true;
      glowingOresCb.disabled = true;
      roundTreesCb.disabled = true;
      crops3dCb.disabled = true;
      optifineCb.title = reason;
      shaderCb.title = reason;
      embossedCb.title = reason;
      voiceChatCb.title = reason;
      fullbrightUbCb.title = reason;
      betterLeavesCb.title = reason;
      glowingOresCb.title = reason;
      roundTreesCb.title = reason;
      crops3dCb.title = reason;
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

    optifineCb.title = opOk
      ? ''
      : 'OptiFine paketi için Minecraft 1.16 veya üstü bir sürüm seçin.';
    embossedCb.title = emOk
      ? ''
      : 'Bu seçenek için Minecraft 1.18 veya üstü bir sürüm seçin (Continuity uyumu).';
    voiceChatCb.title = vcOk
      ? ''
      : 'Voice Chat için Minecraft 1.16 veya üstü bir sürüm seçin.';
    fullbrightUbCb.title = fbOk
      ? ''
      : 'Fullbright UB bu sürüm için desteklenmiyor.';
    betterLeavesCb.title = blOk
      ? ''
      : 'Better Leaves bu sürüm için desteklenmiyor.';
    glowingOresCb.title = goOk
      ? ''
      : 'Glowing Ores için Minecraft 1.17 veya üstü bir sürüm seçin.';
    roundTreesCb.title = rtOk
      ? ''
      : 'Round Trees bu sürüm için desteklenmiyor.';
    crops3dCb.title = c3Ok
      ? ''
      : '3D crops Revamped bu sürüm için desteklenmiyor.';

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

    applyMutualExclusion();
    updateShaderPickerVisibility();
  }

  // Her loader için hangi mod row'ları görünür ve mods-title:
  const ROWS_BY_LOADER = {
    fabric: {
      rows: ['shaderFps', 'optifine', 'embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'Fabric Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + seçilen shader paketi)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity + Sodium)',
    },
    'fabric-beta': {
      rows: ['shaderFps', 'optifine', 'embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'Fabric (Beta) Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + seçilen shader paketi)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity + Sodium)',
    },
    quilt: {
      rows: ['shaderFps', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'Quilt Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + seçilen shader paketi)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity)',
    },
    forge: {
      rows: ['shaderFps', 'embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'Forge Modları',
      shaderLabel: 'Shader + FPS (Embeddium + Oculus + seçilen shader paketi — ⚠ Mac\'te Oculus OpenGL 1282 hatası verebilir; NeoForge veya Fabric önerilir)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (Continuity Forge — sadece 1.20.1)',
    },
    'forge-optifine': {
      rows: ['embossed', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'Forge + OptiFine Modları',
      shaderLabel: '',
      embossedLabel: "Kabartmalı / bağlı bloklar (OptiFine içeride zaten CTM destekler — ek mod gerek yok)",
    },
    neoforge: {
      rows: ['shaderFps', 'voiceChat', 'fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'NeoForge Modları',
      shaderLabel: 'Shader + FPS (Sodium + Iris + seçilen shader paketi)',
      embossedLabel: 'Kabartmalı / bağlı bloklar (NeoForge\'da native Continuity yok — desteklenmiyor)',
    },
    'legacy-fabric': {
      rows: [],
      title: 'Legacy Fabric',
      shaderLabel: '',
      embossedLabel: '',
    },
    liteloader: {
      rows: [],
      title: 'LiteLoader',
      shaderLabel: '',
      embossedLabel: '',
    },
    nilloader: {
      rows: [],
      title: 'NilLoader',
      shaderLabel: '',
      embossedLabel: '',
    },
    ornithe: {
      rows: [],
      title: 'Ornithe',
      shaderLabel: '',
      embossedLabel: '',
    },
    rift: {
      rows: [],
      title: 'Rift',
      shaderLabel: '',
      embossedLabel: '',
    },
    vanilla: {
      rows: ['fullbrightUb', 'betterLeaves', 'glowingOres', 'roundTrees', 'crops3d'],
      title: 'Vanilla Modları',
      shaderLabel: '',
      embossedLabel: '',
    },
    bedrock: {
      rows: [],
      title: 'Minecraft Bedrock',
      shaderLabel: '',
      embossedLabel: '',
    },
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
      config.rows.includes('crops3d');
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

    modsTitle.textContent = config.title;
    if (config.shaderLabel) shaderLabel.textContent = config.shaderLabel;
    if (config.embossedLabel) embossedLabel.textContent = config.embossedLabel;
    modsOptionsBox.style.display = config.rows.length > 0 ? '' : 'none';

    // Loader hint metni
    if (FABRIC_LOADERS.has(loader)) {
      loaderWarning.style.display = 'none';
      loaderWarning.textContent = '';
    } else {
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
          'Legacy Fabric otomatik kurulacak. Kayıtlar ve ayarlar profiles/legacy-fabric-<sürüm>/ altında tutulur. Modları mods/ klasörüne kendiniz eklersiniz.';
      } else if (loader === 'liteloader') {
        loaderWarning.textContent =
          'LiteLoader otomatik kurulacak. Kayıtlar ve ayarlar profiles/liteloader-<sürüm>/ altında tutulur. Modları mods/ klasörüne kendiniz eklersiniz.';
      } else if (loader === 'nilloader') {
        loaderWarning.textContent =
          'NilLoader Java agent olarak indirilir ve vanilla profil üzerinde çalışır. Modları mods/ klasörüne kendiniz eklersiniz.';
      } else if (loader === 'ornithe') {
        loaderWarning.textContent =
          'Ornithe deneysel: ana menü açılabilir ancak dünya/sunucuya girerken Calamus hatasıyla çökebilir. ' +
          '1.12.2 modları için Legacy Fabric kullanmanız önerilir.';
      } else if (loader === 'rift') {
        loaderWarning.textContent =
          'Rift otomatik kurulacak. Kayıtlar ve ayarlar profiles/rift-<sürüm>/ altında tutulur. Yalnızca 1.13 ve 1.13.2 desteklenir.';
      } else if (loader === 'vanilla') {
        loaderWarning.textContent =
          'Vanilla seçili — Minecraft resmi profille başlar. Kaynak paketi modları (Fullbright, Better Leaves, Glowing Ores, Round Trees, 3D crops) seçiliyse otomatik indirilir; parıltı için Fabric+Continuity veya OptiFine gerekir.';
      } else if (loader === 'bedrock') {
        loaderWarning.textContent =
          'Bedrock (Minecraft for Windows) Microsoft Store uygulaması olarak başlatılır. ' +
          'Sürüm seçimi gerekmez; güncellemeler Store/Xbox üzerinden gelir. Yalnızca Windows desteklenir.';
      } else {
        // forge-optifine
        const v = store.getState().selectedVersion;
        if (!forgeOptifineLikelySupported(v)) {
          loaderWarning.textContent =
            `⚠ OptiFine "${v}" sürümünü desteklemiyor. OptiFine en son 1.21.9'a kadar yayınlandı — daha eski bir sürüm seçin veya "Forge" (OptiFine'sız) profilini kullanın.`;
        } else {
          loaderWarning.textContent =
            'Forge + klasik OptiFine.jar otomatik indirilecek. OptiFine kendi shader ve CTM sistemini içerir; Shader + FPS ile aynı anda kullanılamaz.';
        }
      }
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
    if (voiceChatCb.checked !== !!state.modVoiceChat) voiceChatCb.checked = !!state.modVoiceChat;
    if (fullbrightUbCb.checked !== !!state.modFullbrightUb) fullbrightUbCb.checked = !!state.modFullbrightUb;
    if (betterLeavesCb.checked !== !!state.modBetterLeaves) betterLeavesCb.checked = !!state.modBetterLeaves;
    if (glowingOresCb.checked !== !!state.modGlowingOres) glowingOresCb.checked = !!state.modGlowingOres;
    if (roundTreesCb.checked !== !!state.modRoundTrees) roundTreesCb.checked = !!state.modRoundTrees;
    if (crops3dCb.checked !== !!state.modCrops3d) crops3dCb.checked = !!state.modCrops3d;
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
