const DEFAULTS = Object.freeze({ min: 1024, max: 8192, step: 256, initial: 2048 });

export function createMemorySlider({ root, store, i18n }) {
  function render() {
    const state = store.getState();
    const val = state.memoryMb || DEFAULTS.initial;
    root.innerHTML = `
    <div data-role="memory-wrap">
    <label class="field">
      <span>${i18n.t('memory.label')}: <strong data-role="value">${val}</strong></span>
      <input type="range"
        data-role="slider"
        min="${DEFAULTS.min}"
        max="${DEFAULTS.max}"
        step="${DEFAULTS.step}"
        value="${val}" />
    </label>
    </div>
  `;

    const wrap = root.querySelector('[data-role="memory-wrap"]');
    const slider = root.querySelector('[data-role="slider"]');
    const valueLabel = root.querySelector('[data-role="value"]');

    function publish() {
      valueLabel.textContent = slider.value;
      store.setState({ memoryMb: parseInt(slider.value, 10) });
    }

    slider.addEventListener('input', publish);
    const hide = (state.selectedLoader || '') === 'bedrock';
    wrap.style.display = hide ? 'none' : '';
  }

  function mount() {
    render();
    const unsubs = [
      store.subscribe((state) => {
        const wrap = root.querySelector('[data-role="memory-wrap"]');
        if (wrap) {
          const hide = (state.selectedLoader || '') === 'bedrock';
          wrap.style.display = hide ? 'none' : '';
        }
      }),
      i18n.onChange(render),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
