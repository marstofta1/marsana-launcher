import { sanitizeModPresetsForPlayMode, PLAY_MODES } from '../../shared/marsanaClient.js';
import {
  marsanaBundledClientModsAvailable,
  schematicFarmBundledAvailable,
} from '../../shared/versionCompatibility.js';

const EXTERNAL_LOADERS = new Set(['bedrock', 'roblox']);

function launchErrorMessage(err) {
  if (!err) return 'Bilinmeyen hata';
  if (typeof err === 'string') return err;
  return err.message || err.error || String(err);
}

export function createPlayButton({ root, store, launchApi, i18n, robloxApi }) {
  root.innerHTML = `<button class="btn play" disabled data-role="play"></button>`;
  const btn = root.querySelector('[data-role="play"]');

  let isLaunching = false;

  function applyLabels() {
    btn.textContent = i18n.t('play.button');
  }

  function isExternalLoader(loader) {
    return EXTERNAL_LOADERS.has(loader);
  }

  async function handleClick() {
    if (isLaunching) return;
    const state = store.getState();
    const loader = state.selectedLoader || 'fabric';

    if (state.user?.bedrockOnly && !isExternalLoader(loader)) {
      store.setState({ statusText: i18n.t('play.bedrockOnlyBlocked') });
      return;
    }

    if (!isExternalLoader(loader) && !state.user) {
      store.setState({ statusText: i18n.t('play.loginRequired') });
      return;
    }
    if (!isExternalLoader(loader) && !state.selectedVersion) {
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
      lastLaunchVersion: isExternalLoader(loader) ? loader : state.selectedVersion,
    });
    try {
      const s = state.settings || {};
      const version =
        loader === 'bedrock' ? 'bedrock' : loader === 'roblox' ? 'roblox' : state.selectedVersion;
      const clientMenuOk = marsanaBundledClientModsAvailable(version);
      const schematicOk = schematicFarmBundledAvailable(version);
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
          schematicFarm: !!state.modSchematicFarm && schematicOk,
          clientHudPack: state.playMode === 'client' && !!state.modClientHudPack && clientMenuOk,
        },
        state.playMode
      );

      let robloxUsername = s.robloxUsername || '';
      if (loader === 'roblox' && robloxApi && typeof robloxApi.getAccount === 'function') {
        try {
          const saved = await robloxApi.getAccount();
          if (saved?.username) robloxUsername = saved.username;
        } catch {
          /* ignore */
        }
      }

      await launchApi({
        version,
        memoryMb: state.memoryMb,
        offline: state.offline,
        offlineName: state.offlineName,
        selectedLoader: loader,
        shaderSlug: state.selectedShader,
        modPresets,
        robloxUsername,
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
      if (loader !== 'bedrock' && loader !== 'roblox') {
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
    const loader = state.selectedLoader || 'fabric';

    if (loader === 'bedrock') {
      btn.disabled = false;
      btn.title = i18n.t('play.bedrockTitle');
      return;
    }
    if (loader === 'roblox') {
      btn.disabled = false;
      btn.title = i18n.t('play.robloxTitle');
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
    applyLabels();
    updateDisabled(store.getState());
    const unsubs = [
      store.subscribe(updateDisabled),
      i18n.onChange(applyLabels),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
