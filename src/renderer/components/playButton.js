import {
  sanitizeModPresetsForPlayMode,
  sanitizeSelectionForPlayMode,
  isExternalLoader,
  isClientMode,
  PLAY_MODES,
  MARSANA_CLIENT_VERSION,
} from '../../shared/marsanaClient.js';
import {
  marsanaBundledClientModsAvailable,
  schematicFarmBundledAvailable,
} from '../../shared/versionCompatibility.js';

function launchErrorMessage(err) {
  if (!err) return 'Bilinmeyen hata';
  if (typeof err === 'string') return err;
  return err.message || err.error || String(err);
}

export function createPlayButton({ root, store, launchApi, i18n }) {
  root.innerHTML = `<button class="btn play" disabled data-role="play"></button>`;
  const btn = root.querySelector('[data-role="play"]');

  let isLaunching = false;

  function resolveLoader(state) {
    if (isClientMode(state.playMode)) return 'fabric';
    return state.selectedLoader || 'fabric';
  }

  function applyLabels(state = store.getState()) {
    const loader = resolveLoader(state);
    if (loader === 'bedrock') {
      btn.textContent = i18n.t('play.bedrockButton');
    } else {
      btn.textContent = i18n.t('play.button');
    }
  }

  function syncUi(state) {
    root.hidden = false;
    root.style.display = '';
    btn.hidden = false;
    btn.style.display = '';
    applyLabels(state);
    updateDisabled(state);
  }

  async function handleClick() {
    if (isLaunching) return;
    const raw = store.getState();
    const sanitized = sanitizeSelectionForPlayMode(raw);
    if (
      sanitized.selectedLoader !== raw.selectedLoader ||
      sanitized.modSchematicFarm !== raw.modSchematicFarm
    ) {
      store.setState(sanitized);
    }
    const state = store.getState();
    const loader = resolveLoader(state);
    // Client modu sabit sürüm (26.1.2) başlatır; seçili sürüm yok sayılır çünkü
    // Marsana overlay/menü mod'u yalnızca o sürümde yüklenir.
    const clientMode = isClientMode(state.playMode);

    if (state.user?.bedrockOnly && !isExternalLoader(loader)) {
      store.setState({ statusText: i18n.t('play.bedrockOnlyBlocked') });
      return;
    }

    if (!isExternalLoader(loader) && !state.user) {
      store.setState({ statusText: i18n.t('play.loginRequired') });
      return;
    }
    if (!isExternalLoader(loader) && !clientMode && !state.selectedVersion) {
      store.setState({ statusText: i18n.t('play.selectVersion') });
      return;
    }

    isLaunching = true;
    btn.disabled = true;
    store.setState({
      statusText: i18n.t('common.loading'),
      logLines: [],
      progressPercent: 0,
      lastLaunchLoader: loader,
      lastLaunchVersion: isExternalLoader(loader)
        ? loader
        : clientMode
          ? MARSANA_CLIENT_VERSION
          : state.selectedVersion,
    });
    try {
      const s = state.settings || {};
      const version = loader === 'bedrock'
        ? 'bedrock'
        : clientMode
          ? MARSANA_CLIENT_VERSION
          : state.selectedVersion;
      const clientMenuOk = marsanaBundledClientModsAvailable(version);
      const schematicOk = schematicFarmBundledAvailable(version);
      const schematicFarmEnabled =
        schematicOk && (isClientMode(state.playMode) || !!state.modSchematicFarm);
      const modPresets = sanitizeModPresetsForPlayMode(
        {
          marsanaClientMenu: state.playMode === 'client' && clientMenuOk,
          optifine: !!state.modOptifine,
          shaderFps: !!state.modShaderFps,
          embossedBlocks: !!state.modEmbossedBlocks,
          voiceChat: !!state.modVoiceChat,
          fullbrightUb: !!state.modFullbrightUb,
          betterLeaves: !!state.modBetterLeaves,
          glowingOres: !!state.modGlowingOres,
          roundTrees: !!state.modRoundTrees,
          crops3d: !!state.modCrops3d,
          schematicFarm: schematicFarmEnabled,
          sodium: !!state.modSodium,
          sodiumExtra: !!state.modSodiumExtra,
          clientHudPack: state.playMode === 'client' && !!state.modClientHudPack && clientMenuOk,
        },
        state.playMode
      );

      await launchApi({
        version,
        memoryMb: state.memoryMb,
        offline: state.offline,
        offlineName: state.offlineName,
        selectedLoader: loader,
        shaderSlug: state.selectedShader,
        modPresets,
        audioSettings:
          typeof s.masterVolume === 'number' || typeof s.musicVolume === 'number'
            ? {
                masterVolume: typeof s.masterVolume === 'number' ? s.masterVolume / 100 : null,
                musicVolume: typeof s.musicVolume === 'number' ? s.musicVolume / 100 : null,
              }
            : null,
        playMode:
          state.playMode === PLAY_MODES.LAUNCHER ? PLAY_MODES.LAUNCHER : PLAY_MODES.CLIENT,
        selectedCosmetic: state.selectedCosmetic || 'none',
      });
      if (loader !== 'bedrock') {
        store.setState({ statusText: i18n.t('launch.started', { version }) });
      }
    } catch (err) {
      store.setState({ statusText: i18n.t('common.error', { message: launchErrorMessage(err) }) });
    } finally {
      isLaunching = false;
      updateDisabled(store.getState());
    }
  }

  function updateDisabled(state) {
    if (isLaunching) {
      btn.disabled = true;
      return;
    }
    const loader = resolveLoader(state);

    if (loader === 'bedrock') {
      btn.disabled = false;
      btn.title = i18n.t('play.bedrockTitle');
      return;
    }
    if (state.user?.bedrockOnly) {
      btn.disabled = true;
      btn.title = i18n.t('play.bedrockOnlyTitle');
      return;
    }
    btn.title = '';
    btn.disabled = !state.user || !state.selectedVersion;
  }

  btn.addEventListener('click', handleClick);

  function mount() {
    syncUi(store.getState());
    const unsubs = [
      store.subscribe(syncUi),
      i18n.onChange(() => syncUi(store.getState())),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
