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

export function createPlayerProfileCard({ root, store }) {
  let lastUuid = null;

  function renderLoggedIn(user) {
    if (user.uuid === lastUuid) return;
    lastUuid = user.uuid;
    root.innerHTML = `
      <h3>Profil</h3>
      <div class="profile-body">
        <div class="profile-skin">
          <img
            class="profile-skin-img"
            alt="${user.name} 3B vücut"
            src="${bodyRenderUrl(user.uuid)}"
            onerror="this.style.visibility='hidden'"
          />
        </div>
        <div class="profile-info">
          <div class="profile-name">${user.name}</div>
          <div class="profile-tag">
            <span class="profile-badge">Microsoft</span>
            <span class="profile-badge ghost">Java Edition</span>
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
      <h3>Profil</h3>
      <p class="hint">Microsoft hesabıyla giriş yaptığında skin'in ve hesap bilgilerin burada görünür.</p>
    `;
  }

  function update(state) {
    if (state.user && state.user.uuid) renderLoggedIn(state.user);
    else renderAnonymous();
  }

  function mount() {
    renderAnonymous();
    update(store.getState());
    return store.subscribe(update);
  }

  return { mount };
}
