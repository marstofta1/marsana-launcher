'use strict';

const { Auth } = require('msmc');
const { LauncherError, Codes } = require('../infra/errors');
const {
  normalizeAuthMethod,
  getAuthMethodOption,
  AUTH_METHODS,
} = require('../../shared/authMethods.cjs');

function toAccount(xboxManager, mcToken) {
  const expiresIn = mcToken.expires_in ? mcToken.expires_in * 1000 : 24 * 60 * 60 * 1000;
  return {
    name: mcToken.profile.name,
    uuid: mcToken.profile.id,
    accessToken: mcToken.mcToken,
    refreshToken: xboxManager.msToken.refresh_token,
    expiresAt: Date.now() + expiresIn,
    xuid: mcToken.profile.xuid || null,
    loginMethod: AUTH_METHODS.MICROSOFT,
    bedrockOnly: false,
  };
}

function extractXboxGamertag(xboxManager) {
  const profile = xboxManager?.profile || xboxManager?.mclc?.profile || null;
  const msToken = xboxManager?.msToken || null;
  const name =
    profile?.name ||
    profile?.gamertag ||
    msToken?.account?.username ||
    msToken?.account?.name ||
    null;
  const xuid = profile?.xuid || profile?.id || msToken?.xuid || null;
  return { name, xuid };
}

function toBedrockOnlyAccount(xboxManager, loginMethod) {
  const { name, xuid } = extractXboxGamertag(xboxManager);
  const displayName = name || 'Bedrock Oyuncusu';
  const uuidSeed = xuid || displayName;
  const uuid = xuid && /^[0-9a-f-]{36}$/i.test(xuid)
    ? xuid
    : `00000000-0000-4000-8000-${Buffer.from(uuidSeed).toString('hex').slice(0, 12).padEnd(12, '0')}`.slice(0, 36);
  return {
    name: displayName,
    uuid,
    accessToken: null,
    refreshToken: xboxManager?.msToken?.refresh_token || null,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    xuid: xuid || null,
    loginMethod: loginMethod || AUTH_METHODS.XBOX,
    bedrockOnly: true,
  };
}

function createMicrosoftAuthProvider() {
  function explainMsmcError(err, option) {
    if (!err) return 'bilinmeyen hata';
    if (err.ts === 'error.auth.minecraft.profile') {
      let msg =
        'Bu Microsoft hesabı Minecraft Java Edition\'a sahip değil. ' +
        'Java Edition satın almalısın (minecraft.net) veya Game Pass\'in varsa önce xbox.com üzerinden Java Edition\'ı etkinleştirmelisin.';
      if (option.id === AUTH_METHODS.PLAYSTATION) {
        msg +=
          ' PlayStation hesabın Java\'ya bağlı değilse önce PSN ↔ Microsoft eşleştirmesi yap.';
      }
      return msg;
    }
    if (err.ts === 'error.auth.xsts.userNotFound') {
      return 'Bu Microsoft hesabının Xbox profili yok. xbox.com üzerinden Xbox profili oluştur.';
    }
    if (err.ts === 'error.auth.xsts.minor') {
      return 'Hesap çocuk olarak tanımlı; aile yöneticisi Xbox Live için izin vermeli.';
    }
    if (err.ts === 'error.auth.xsts.banned') {
      return 'Hesap bulunduğun ülkede Xbox Live tarafından engellenmiş.';
    }
    if (err.ts) return `Microsoft auth hatası: ${err.ts}`;
    return err.message || err.code || 'bilinmeyen hata';
  }

  async function interactiveLogin(method) {
    const option = getAuthMethodOption(method);
    const loginMethod = normalizeAuthMethod(method);
    let xboxManager = null;
    try {
      const authManager = new Auth(option.prompt);
      xboxManager = await authManager.launch('electron', {
        width: 520,
        height: 720,
        title: option.windowTitle,
        resizable: true,
      });
      const mcToken = await xboxManager.getMinecraft();
      return toAccount(xboxManager, mcToken);
    } catch (err) {
      if (err && err.ts === 'error.auth.minecraft.profile' && xboxManager) {
        console.warn('[auth] Java Edition yok — Bedrock-only oturum aciliyor', loginMethod);
        return toBedrockOnlyAccount(xboxManager, loginMethod);
      }
      console.error('[auth] Giriş başarısız:', loginMethod, err);
      throw new LauncherError(Codes.AUTH_FAILED, explainMsmcError(err, option), err);
    }
  }

  async function refresh(refreshToken) {
    if (!refreshToken) return null;
    try {
      const authManager = new Auth('select_account');
      const xboxManager = await authManager.refresh(refreshToken);
      const mcToken = await xboxManager.getMinecraft();
      const cached = toAccount(xboxManager, mcToken);
      return cached;
    } catch {
      return null;
    }
  }

  return { interactiveLogin, refresh };
}

module.exports = { createMicrosoftAuthProvider };
