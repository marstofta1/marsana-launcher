import { AUTH_METHODS, AUTH_METHOD_OPTIONS } from '../../shared/authMethods.js';

function avatarUrl(uuid) {
  const clean = (uuid || '').replace(/-/g, '');
  return `https://mc-heads.net/avatar/${clean}/64`;
}

function userCardFingerprint(user) {
  if (!user) return '';
  return `${user.uuid}\0${user.name}\0${user.loginMethod || ''}`;
}

const OPENING_KEYS = {
  [AUTH_METHODS.MICROSOFT]: 'auth.openingMicrosoft',
  [AUTH_METHODS.XBOX]: 'auth.openingXbox',
  [AUTH_METHODS.PLAYSTATION]: 'auth.openingPlaystation',
};

export function createAccountCard({ root, store, auth, openExternal, i18n }) {
  let lastFingerprint = null;
  let loggingIn = false;

  function methodLabel(method) {
    const id = method || AUTH_METHODS.MICROSOFT;
    return i18n.t(`account.${id}`);
  }

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
    via.textContent = user.bedrockOnly
      ? i18n.t('account.bedrockOnly')
      : methodLabel(user.loginMethod);
    meta.appendChild(via);

    wrap.appendChild(meta);

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn ghost';
    logoutBtn.textContent = i18n.t('common.logout');
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
    const openingKey = OPENING_KEYS[option.id] || OPENING_KEYS[AUTH_METHODS.MICROSOFT];
    store.setState({ statusText: i18n.t(openingKey) });
    const buttons = root.querySelectorAll('.auth-method');
    for (const b of buttons) {
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
    }
    try {
      const user = await auth.login(option.id);
      const patch = {
        user,
        statusText: user.bedrockOnly
          ? i18n.t('auth.bedrockOnlyLoginSuccess', { name: user.name })
          : i18n.t('auth.loginSuccess', { name: user.name }),
      };
      if (user.bedrockOnly) {
        patch.selectedLoader = 'bedrock';
      }
      store.setState(patch);
    } catch (err) {
      store.setState({
        statusText: i18n.t('auth.loginFailed', { error: err.message || err }),
      });
    } finally {
      loggingIn = false;
      for (const b of root.querySelectorAll('.auth-method')) {
        b.disabled = false;
        b.removeAttribute('aria-busy');
      }
    }
  }

  function renderAnonymous() {
    root.innerHTML = '';

    const intro = document.createElement('p');
    intro.className = 'auth-intro';
    intro.textContent = i18n.t('auth.loginIntro');
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
      label.textContent = methodLabel(option.id);
      btn.appendChild(label);

      btn.addEventListener('click', () => handleLogin(option));
      grid.appendChild(btn);
    }

    root.appendChild(grid);

    const psOption = AUTH_METHOD_OPTIONS.find((o) => o.id === AUTH_METHODS.PLAYSTATION);
    if (psOption?.helpUrl) {
      const hint = document.createElement('p');
      hint.className = 'auth-hint';
      hint.textContent = `${i18n.t('auth.psHelpHint')} `;
      if (openExternal) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'link-btn';
        link.textContent = i18n.t('auth.howToLink');
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

  function remountI18n() {
    lastFingerprint = null;
    update(store.getState());
  }

  function mount() {
    update(store.getState());
    const unsubs = [store.subscribe(update), i18n.onChange(remountI18n)];
    return () => unsubs.forEach((u) => u());
  }

  return { mount };
}
