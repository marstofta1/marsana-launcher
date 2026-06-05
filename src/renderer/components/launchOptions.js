export function createLaunchOptions({ root, store, i18n }) {
  function render() {
    const state = store.getState();
    root.innerHTML = `
    <div data-role="launch-options-wrap">
    <label class="field checkbox">
      <input type="checkbox" data-role="offline" ${state.offline ? 'checked' : ''} />
      <span>${i18n.t('launchOptions.offline')}</span>
    </label>

    <label class="field" data-role="offlineNameField" style="display:${state.offline ? 'block' : 'none'};">
      <span>${i18n.t('launchOptions.offlineName')}</span>
      <input type="text" data-role="offlineName" maxlength="16" placeholder="${i18n.t('launchOptions.offlineNamePlaceholder')}" value="${state.offlineName || ''}" autocomplete="off" />
    </label>
    </div>
  `;

    const wrap = root.querySelector('[data-role="launch-options-wrap"]');
    const offline = root.querySelector('[data-role="offline"]');
    const offlineNameField = root.querySelector('[data-role="offlineNameField"]');
    const offlineNameInput = root.querySelector('[data-role="offlineName"]');

    function publish() {
      store.setState({
        offline: offline.checked,
        offlineName: offlineNameInput.value,
      });
    }

    offline.addEventListener('change', () => {
      offlineNameField.style.display = offline.checked ? 'block' : 'none';
      publish();
    });
    offlineNameInput.addEventListener('input', publish);

    wrap.style.display = (state.selectedLoader || '') === 'bedrock' ? 'none' : '';
  }

  function mount() {
    render();
    const unsubs = [
      store.subscribe((state) => {
        const wrap = root.querySelector('[data-role="launch-options-wrap"]');
        if (wrap) wrap.style.display = (state.selectedLoader || '') === 'bedrock' ? 'none' : '';
      }),
      i18n.onChange(render),
    ];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
