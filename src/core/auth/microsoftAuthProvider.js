'use strict';

const { Auth } = require('msmc');
const { LauncherError, Codes } = require('../infra/errors');
const {
  normalizeAuthMethod,
  getAuthMethodOption,
  AUTH_METHODS,
} = require('../../shared/authMethods.cjs');

function toAccount(xboxManager, mcToken, loginMethod) {
  const expiresIn = mcToken.expires_in ? mcToken.expires_in * 1000 : 24 * 60 * 60 * 1000;
  return {
    name: mcToken.profile.name,
    uuid: mcToken.profile.id,
    accessToken: mcToken.mcToken,
    refreshToken: xboxManager.msToken.refresh_token,
    expiresAt: Date.now() + expiresIn,
    xuid: mcToken.profile.xuid || null,
    loginMethod: loginMethod || AUTH_METHODS.MICROSOFT,
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
    try {
      const authManager = new Auth(option.prompt);
      const xboxManager = await authManager.launch('electron', {
        width: 520,
        height: 720,
        title: option.windowTitle,
        resizable: true,
      });
      const mcToken = await xboxManager.getMinecraft();
      return toAccount(xboxManager, mcToken, loginMethod);
    } catch (err) {
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
