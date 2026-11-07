'use strict';

const crypto = require('crypto');
const { LauncherError, Codes } = require('../infra/errors');

const TOKEN_SAFETY_MARGIN_MS = 60_000;
const OFFLINE_NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Minecraft'ın çevrimdışı UUID'si: UUID.nameUUIDFromBytes("OfflinePlayer:" + isim) (v3/MD5). */
function offlineUuid(name) {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toPublicView(account) {
  if (!account) return null;
  return {
    name: account.name,
    uuid: account.uuid,
    xuid: account.xuid || null,
    expiresAt: account.expiresAt,
    loginMethod: account.loginMethod || 'microsoft',
    bedrockOnly: !!account.bedrockOnly,
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
    if (cached.bedrockOnly) return toPublicView(cached);
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

    // Hesapsız (çevrimdışı/cracked) giriş: Microsoft hesabı gerekmez, yalnız bir isim.
    // Tek oyunculu, LAN ve online-mode=false sunucularda çalışır.
    if (allowOffline && (!account || account.bedrockOnly)) {
      const name = (overrideName || '').trim();
      if (!OFFLINE_NAME_RE.test(name)) {
        throw new LauncherError(
          Codes.AUTH_REQUIRED,
          'Çevrimdışı oynamak için 3-16 karakterlik bir isim gir (harf, rakam, alt çizgi).'
        );
      }
      const uuid = offlineUuid(name);
      return {
        access_token: '0',
        client_token: uuid,
        uuid,
        name,
        user_properties: '{}',
        meta: { type: 'mojang', demo: false, offline: true },
      };
    }

    if (!account) {
      throw new LauncherError(Codes.AUTH_REQUIRED, 'Önce Microsoft hesabıyla giriş yapmalısın.');
    }
    if (account.bedrockOnly) {
      throw new LauncherError(
        Codes.BEDROCK_ONLY_ACCOUNT,
        'Bu hesapta Minecraft Java Edition lisansı yok. Yükleyici olarak Bedrock seçip Oyna\'ya bas.'
      );
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

module.exports = { createAuthService, offlineUuid };
