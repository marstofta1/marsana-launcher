const ACCOUNTS_KEY = 'marsana.offlineAccounts';
const MAX_ACCOUNTS = 30;
const NAME_MAX = 16;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function loadAccounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((n) => typeof n === 'string' && n) : [];
  } catch {
    return [];
  }
}

function saveAccounts(list) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function createLaunchOptions({ root, store, i18n }) {
  let accountsOpen = false;

  function rememberAccount(rawName) {
    const name = (rawName || '').trim().slice(0, NAME_MAX);
    if (!name) return;
    const list = loadAccounts().filter((n) => n.toLowerCase() !== name.toLowerCase());
    list.unshift(name);
    saveAccounts(list.slice(0, MAX_ACCOUNTS));
  }

  function accountsHtml(state) {
    const list = loadAccounts();
    const active = (state.offlineName || '').trim().toLowerCase();
    const items = list.length
      ? list.map((n) => `
        <li class="offline-account${state.offline && n.toLowerCase() === active ? ' active' : ''}">
          <button type="button" class="offline-account-pick" data-account="${escapeHtml(n)}">${escapeHtml(n)}</button>
          <button type="button" class="offline-account-del" data-del="${escapeHtml(n)}" title="${i18n.t('launchOptions.offlineAccountDelete')}" aria-label="${i18n.t('launchOptions.offlineAccountDelete')}">×</button>
        </li>`).join('')
      : `<li class="offline-account-empty">${i18n.t('launchOptions.offlineAccountsEmpty')}</li>`;
    return `
      <button type="button" class="offline-accounts-toggle" data-role="accountsToggle" aria-expanded="${accountsOpen}">
        ${i18n.t('launchOptions.offlineAccounts')} (${list.length}) ${accountsOpen ? '▴' : '▾'}
      </button>
      <ul class="offline-accounts-list" data-role="accountsList" style="display:${accountsOpen ? 'block' : 'none'};">${items}</ul>`;
  }

  function render() {
    const state = store.getState();
    root.innerHTML = `
    <div data-role="launch-options-wrap">
    <div class="offline-accounts">${accountsHtml(state)}</div>
    <label class="field checkbox">
      <input type="checkbox" data-role="offline" ${state.offline ? 'checked' : ''} />
      <span>${i18n.t('launchOptions.offline')}</span>
    </label>

    <div data-role="offlineNameField" style="display:${state.offline ? 'block' : 'none'};">
      <label class="field">
        <span>${i18n.t('launchOptions.offlineName')}</span>
        <input type="text" data-role="offlineName" maxlength="${NAME_MAX}" placeholder="${i18n.t('launchOptions.offlineNamePlaceholder')}" value="${escapeHtml(state.offlineName || '')}" autocomplete="off" />
      </label>
    </div>
    </div>
  `;

    const wrap = root.querySelector('[data-role="launch-options-wrap"]');
    const offline = root.querySelector('[data-role="offline"]');
    const offlineNameField = root.querySelector('[data-role="offlineNameField"]');
    const offlineNameInput = root.querySelector('[data-role="offlineName"]');
    const toggle = root.querySelector('[data-role="accountsToggle"]');
    const list = root.querySelector('[data-role="accountsList"]');

    function publish() {
      store.setState({
        offline: offline.checked,
        offlineName: offlineNameInput.value,
      });
    }

    offline.addEventListener('change', () => {
      offlineNameField.style.display = offline.checked ? 'block' : 'none';
      publish();
      if (offline.checked) rememberAccount(offlineNameInput.value);
    });
    offlineNameInput.addEventListener('input', publish);
    const commitName = () => {
      rememberAccount(offlineNameInput.value);
      render();
    };
    offlineNameInput.addEventListener('change', commitName);
    offlineNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') offlineNameInput.blur();
    });

    toggle.addEventListener('click', () => {
      accountsOpen = !accountsOpen;
      render();
    });

    list.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-account]');
      const del = e.target.closest('[data-del]');
      if (pick) {
        // Hesaba tıklamak çevrimdışı modu da açar ve o hesabı seçer.
        const name = pick.getAttribute('data-account');
        store.setState({ offline: true, offlineName: name });
        rememberAccount(name);
        render();
      } else if (del) {
        const name = del.getAttribute('data-del');
        saveAccounts(loadAccounts().filter((n) => n !== name));
        render();
      }
    });

    wrap.style.display = (state.selectedLoader || '') === 'bedrock' ? 'none' : '';
  }

  function mount() {
    render();
    const unsubs = [
      store.subscribe((state) => {
        const wrap = root.querySelector('[data-role="launch-options-wrap"]');
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
