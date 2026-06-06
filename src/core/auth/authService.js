'use strict';

const { LauncherError, Codes } = require('../infra/errors');

const TOKEN_SAFETY_MARGIN_MS = 60_000;

function toPublicView(account) {
  if (!account) return null;
  return {
    name: account.name,
    uuid: account.uuid,
    xuid: account.xuid || null,
    expiresAt: account.expiresAt,
    loginMethod: 'microsoft',
  };
}

function createAuthService({ store, authProvider, logger }) {
  async function login(method) {
    const account = await authProvider.interactiveLogin(method);
    store.save(account);
    logger.info('Account logged in', {
      name: account.name,
      uuid: account.uuid,
      loginMethod: account.loginMethod,
    });
    return toPublicView(account);
  }

  async function refreshIfPossible() {
    const cached = store.load();
    if (!cached) return null;
    const refreshed = await authProvider.refresh(cached.refreshToken);
    if (refreshed) {
      const merged = {
        ...refreshed,
        loginMethod: 'microsoft',
      };
      store.save(merged);
      return toPublicView(merged);
    }
    return toPublicView(cached);
  }

  function current() {
    return toPublicView(store.load());
  }

  function logout() {
    store.clear();
    logger.info('Account logged out');
    return true;
  }

  function buildLaunchProfile({ allowOffline = false, overrideName = '' } = {}) {
    const account = store.load();
    if (!account) {
      throw new LauncherError(Codes.AUTH_REQUIRED, 'Önce Microsoft hesabıyla giriş yapmalısın.');
    }

    if (allowOffline) {
      const trimmed = (overrideName || '').trim();
      const name = trimmed ? trimmed.slice(0, 16) : account.name;
      return {
        access_token: '0',
        client_token: account.uuid,
        uuid: account.uuid,
        name,
        user_properties: '{}',
        meta: { type: 'mojang', demo: false, offline: true },
      };
    }

    const tokenValid =
      account.expiresAt && account.expiresAt > Date.now() + TOKEN_SAFETY_MARGIN_MS;
    if (!tokenValid) {
      throw new LauncherError(
        Codes.TOKEN_EXPIRED,
        'Oturum süresi geçmiş. Lütfen tekrar giriş yap veya çevrimdışı modu seç.'
      );
    }

    return {
      access_token: account.accessToken,
      client_token: account.uuid,
      uuid: account.uuid,
      name: account.name,
      user_properties: '{}',
      meta: { type: 'msa', xuid: account.xuid, demo: false },
    };
  }

  return { login, refreshIfPossible, current, logout, buildLaunchProfile };
}

module.exports = { createAuthService };
