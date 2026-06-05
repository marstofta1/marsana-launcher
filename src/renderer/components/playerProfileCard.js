
function cleanUuid(uuid) {
  return String(uuid || '').replace(/-/g, '');
}

function bodyRenderUrl(uuid) {
  return `https://mc-heads.net/body/${cleanUuid(uuid)}/280`;
}

function formatUuid(uuid) {
  const c = cleanUuid(uuid);
  if (c.length !== 32) return uuid || '';
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
}

export function createPlayerProfileCard({ root, store, i18n }) {
  let lastUuid = null;

  function loginMethodLabel(method) {
    const id = method || 'microsoft';
    return i18n.t(`account.${id}`);
  }

  function renderLoggedIn(user) {
    if (user.uuid === lastUuid) return;
    lastUuid = user.uuid;
    root.innerHTML = `
      <h3>${i18n.t('profile.title')}</h3>
      <div class="profile-body">
        <div class="profile-skin">
          <img
            class="profile-skin-img"
            alt="${user.name} 3B"
            src="${bodyRenderUrl(user.uuid)}"
            onerror="this.style.visibility='hidden'"
          />
        </div>
        <div class="profile-info">
          <div class="profile-name">${user.name}</div>
          <div class="profile-tag">
            <span class="profile-badge">${loginMethodLabel(user.loginMethod)}</span>
            <span class="profile-badge ghost">${i18n.t('profile.javaEdition')}</span>
          </div>
          <div class="profile-meta">
            <span class="profile-meta-label">UUID</span>
            <code class="profile-uuid">${formatUuid(user.uuid)}</code>
          </div>
        </div>
      </div>
    `;
  }

  function renderAnonymous() {
    if (lastUuid === null) return;
    lastUuid = null;
    root.innerHTML = `
      <h3>${i18n.t('profile.title')}</h3>
      <p class="hint">${i18n.t('profile.anonymousHint')}</p>
    `;
  }

  function update(state) {
    if (state.user && state.user.uuid) renderLoggedIn(state.user);
    else renderAnonymous();
  }

  function remountI18n() {
    lastUuid = null;
    update(store.getState());
  }

  function mount() {
    renderAnonymous();
    update(store.getState());
    const unsubs = [store.subscribe(update), i18n.onChange(remountI18n)];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
