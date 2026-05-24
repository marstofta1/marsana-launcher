export function createPlayButton({ root, store, launchApi }) {
  root.innerHTML = `<button class="btn play" disabled data-role="play">OYNA</button>`;
  const btn = root.querySelector('[data-role="play"]');

  async function handleClick() {
    const state = store.getState();
    if (!state.user || !state.selectedVersion) return;
    const loader = state.selectedLoader || 'fabric';
    btn.disabled = true;
    store.setState({
      statusText: 'Başlatılıyor...',
      logLines: [],
      progressPercent: 0,
    });
    try {
      const s = state.settings || {};
      await launchApi({
        version: state.selectedVersion,
        memoryMb: state.memoryMb,
        offline: state.offline,
        offlineName: state.offlineName,
        selectedLoader: loader,
        modPresets: {
          optifine: !!state.modOptifine,
          shaderFps: !!state.modShaderFps,
          embossedBlocks: !!state.modEmbossedBlocks,
        },
        audioSettings:
          typeof s.masterVolume === 'number' || typeof s.musicVolume === 'number'
            ? {
                masterVolume: typeof s.masterVolume === 'number' ? s.masterVolume / 100 : null,
                musicVolume: typeof s.musicVolume === 'number' ? s.musicVolume / 100 : null,
              }
            : null,
      });
    } catch (err) {
      store.setState({ statusText: 'Hata: ' + (err.message || err) });
    } finally {
      updateDisabled(store.getState());
    }
  }

  function updateDisabled(state) {
    btn.disabled = !state.user || !state.selectedVersion;
  }

  btn.addEventListener('click', handleClick);

  function mount() {
    updateDisabled(store.getState());
    return store.subscribe(updateDisabled);
  }

  return { mount };
}
