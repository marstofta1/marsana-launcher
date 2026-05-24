function avatarUrl(uuid) {
  const clean = (uuid || '').replace(/-/g, '');
  return `https://mc-heads.net/avatar/${clean}/64`;
}

function userCardFingerprint(user) {
  if (!user) return '';
  return `${user.uuid}\0${user.name}`;
}

export function createAccountCard({ root, store, auth }) {
  let lastFingerprint = null;

  function renderLoggedIn(user) {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'user';

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = user.name;
    avatar.src = avatarUrl(user.uuid);
    avatar.onerror = () => { avatar.style.visibility = 'hidden'; };
    wrap.appendChild(avatar);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = user.name;
    wrap.appendChild(name);

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn ghost';
    logoutBtn.textContent = 'Çıkış';
    logoutBtn.addEventListener('click', async () => {
      await auth.logout();
      store.setState({ user: null });
    });
    wrap.appendChild(logoutBtn);

    root.appendChild(wrap);
  }

  function renderAnonymous() {
    root.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Microsoft ile giriş yap';
    btn.addEventListener('click', async () => {
      store.setState({ statusText: 'Microsoft giriş penceresi açılıyor...' });
      try {
        const user = await auth.login();
        store.setState({ user, statusText: `Giriş başarılı: ${user.name}` });
      } catch (err) {
        store.setState({ statusText: 'Giriş başarısız: ' + (err.message || err) });
      }
    });
    root.appendChild(btn);
  }

  function update(state) {
    const fp = userCardFingerprint(state.user);
    if (fp === lastFingerprint) return;
    lastFingerprint = fp;
    if (state.user) renderLoggedIn(state.user);
    else renderAnonymous();
  }

  function mount() {
    update(store.getState());
    return store.subscribe(update);
  }

  return { mount };
}
