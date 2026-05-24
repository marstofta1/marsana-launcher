const DEFAULTS = Object.freeze({ min: 1024, max: 8192, step: 256, initial: 2048 });

export function createMemorySlider({ root, store }) {
  root.innerHTML = `
    <label class="field">
      <span>RAM (MB): <strong data-role="value">${DEFAULTS.initial}</strong></span>
      <input type="range"
        data-role="slider"
        min="${DEFAULTS.min}"
        max="${DEFAULTS.max}"
        step="${DEFAULTS.step}"
        value="${DEFAULTS.initial}" />
    </label>
  `;

  const slider = root.querySelector('[data-role="slider"]');
  const valueLabel = root.querySelector('[data-role="value"]');

  function publish() {
    valueLabel.textContent = slider.value;
    store.setState({ memoryMb: parseInt(slider.value, 10) });
  }

  slider.addEventListener('input', publish);

  function mount() {
    publish();
  }

  return { mount };
}
