import { AUTH_METHOD_OPTIONS } from '../../shared/authMethods.js';

function avatarUrl(uuid) {
  const clean = (uuid || '').replace(/-/g, '');
  return `https://mc-heads.net/avatar/${clean}/64`;
}

function userCardFingerprint(user) {
  if (!user) return '';
  return `${user.uuid}\0${user.name}\0${user.loginMethod || ''}`;
}

function loginMethodLabel(method) {
  const option = AUTH_METHOD_OPTIONS.find((o) => o.id === method);
  return option ? option.shortLabel : 'Microsoft';
}

export function createAccountCard({ root, store, auth, openExternal }) {
  let lastFingerprint = null;
  let loggingIn = false;

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

    const meta = document.createElement('div');
    meta.className = 'user-meta';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = user.name;
    meta.appendChild(name);

    const via = document.createElement('span');
    via.className = 'user-via';
    via.textContent = loginMethodLabel(user.loginMethod);
    meta.appendChild(via);

    wrap.appendChild(meta);

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

  async function handleLogin(option) {
    if (loggingIn) return;
    loggingIn = true;
    store.setState({ statusText: option.statusOpening });
    try {
      const user = await auth.login(option.id);
      store.setState({ user, statusText: `Giriş başarılı: ${user.name}` });
    } catch (err) {
      store.setState({ statusText: 'Giriş başarısız: ' + (err.message || err) });
    } finally {
      loggingIn = false;
    }
  }

  function renderAnonymous() {
    root.innerHTML = '';

    const intro = document.createElement('p');
    intro.className = 'auth-intro';
    intro.textContent = 'Java Edition için hesabınla giriş yap:';
    root.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'auth-methods';

    for (const option of AUTH_METHOD_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn auth-method auth-method--${option.id}`;
      btn.title = option.description;

      const label = document.createElement('span');
      label.className = 'auth-method-label';
      label.textContent = option.label;
      btn.appendChild(label);

      btn.addEventListener('click', () => handleLogin(option));
      grid.appendChild(btn);
    }

    root.appendChild(grid);

    const psOption = AUTH_METHOD_OPTIONS.find((o) => o.id === 'playstation');
    if (psOption?.helpHint) {
      const hint = document.createElement('p');
      hint.className = 'auth-hint';
      hint.textContent = psOption.helpHint + ' ';
      if (psOption.helpUrl && openExternal) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'link-btn';
        link.textContent = 'Nasıl bağlanır?';
        link.addEventListener('click', () => openExternal(psOption.helpUrl));
        hint.appendChild(link);
      }
      root.appendChild(hint);
    }
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
