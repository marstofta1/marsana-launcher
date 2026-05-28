export function createLaunchOptions({ root, store }) {
  root.innerHTML = `
    <div data-role="launch-options-wrap">
    <label class="field checkbox">
      <input type="checkbox" data-role="offline" />
      <span>Çevrimdışı modda başlat (sadece daha önce giriş yapılmışsa)</span>
    </label>

    <label class="field" data-role="offlineNameField" style="display:none;">
      <span>Çevrimdışı görünen isim (boş bırakılırsa hesap ismi)</span>
      <input type="text" data-role="offlineName" maxlength="16" placeholder="Steve" autocomplete="off" />
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

  function mount() {
    publish();
    return store.subscribe((state) => {
      const isBedrock = (state.selectedLoader || '') === 'bedrock';
      if (wrap) wrap.style.display = isBedrock ? 'none' : '';
    });
  }

  return { mount };
}
