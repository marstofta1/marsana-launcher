import { sanitizeModPresetsForPlayMode, PLAY_MODES } from '../../shared/marsanaClient.js';

export function createPlayButton({ root, store, launchApi, i18n }) {
  root.innerHTML = `<button class="btn play" disabled data-role="play"></button>`;
  const btn = root.querySelector('[data-role="play"]');

  let isLaunching = false;

  function applyLabels() {
    btn.textContent = i18n.t('play.button');
  }

  async function handleClick() {
    if (isLaunching) return;
    const state = store.getState();
    const loader = state.selectedLoader || 'fabric';
    if (loader !== 'bedrock' && !state.user) return;
    if (loader !== 'bedrock' && !state.selectedVersion) return;
    isLaunching = true;
    btn.disabled = true;
    store.setState({
      statusText: i18n.t('common.loading'),
      logLines: [],
      progressPercent: 0,
      lastLaunchLoader: loader,
      lastLaunchVersion: state.selectedVersion,
    });
    try {
      const s = state.settings || {};
      await launchApi({
        version: loader === 'bedrock' ? 'bedrock' : state.selectedVersion,
        memoryMb: state.memoryMb,
        offline: state.offline,
        offlineName: state.offlineName,
        selectedLoader: loader,
        shaderSlug: state.selectedShader,
        modPresets: sanitizeModPresetsForPlayMode(
          {
            marsanaClientMenu: state.playMode === 'client',
            optifine: !!state.modOptifine,
            shaderFps: !!state.modShaderFps,
            embossedBlocks: !!state.modEmbossedBlocks,
            voiceChat: !!state.modVoiceChat,
            fullbrightUb: !!state.modFullbrightUb,
            betterLeaves: !!state.modBetterLeaves,
            glowingOres: !!state.modGlowingOres,
            roundTrees: !!state.modRoundTrees,
            crops3d: !!state.modCrops3d,
            clientHudPack: state.playMode === 'client' && !!state.modClientHudPack,
          },
          state.playMode
        ),
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
    } catch (err) {
      store.setState({ statusText: i18n.t('common.error', { message: err.message || err }) });
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
