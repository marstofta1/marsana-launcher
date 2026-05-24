'use strict';

const { Auth } = require('msmc');
const { LauncherError, Codes } = require('../infra/errors');

const PROMPT = 'select_account';

function toAccount(xboxManager, mcToken) {
  const expiresIn = mcToken.expires_in ? mcToken.expires_in * 1000 : 24 * 60 * 60 * 1000;
  return {
    name: mcToken.profile.name,
    uuid: mcToken.profile.id,
    accessToken: mcToken.mcToken,
    refreshToken: xboxManager.msToken.refresh_token,
    expiresAt: Date.now() + expiresIn,
    xuid: mcToken.profile.xuid || null,
  };
}

function createMicrosoftAuthProvider() {
  function explainMsmcError(err) {
    if (!err) return 'bilinmeyen hata';
    if (err.ts === 'error.auth.minecraft.profile') {
      return (
        'Bu Microsoft hesabı Minecraft Java Edition\'a sahip değil. ' +
        'Java Edition satın almalısın (minecraft.net) veya Game Pass\'in varsa önce xbox.com üzerinden Java Edition\'ı etkinleştirmelisin.'
      );
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

  async function interactiveLogin() {
    try {
      const authManager = new Auth(PROMPT);
      const xboxManager = await authManager.launch('electron');
      const mcToken = await xboxManager.getMinecraft();
      return toAccount(xboxManager, mcToken);
    } catch (err) {
      console.error('[auth] Microsoft girişi başarısız:', err);
      throw new LauncherError(Codes.AUTH_FAILED, explainMsmcError(err), err);
    }
  }

  async function refresh(refreshToken) {
    if (!refreshToken) return null;
    try {
      const authManager = new Auth(PROMPT);
      const xboxManager = await authManager.refresh(refreshToken);
      const mcToken = await xboxManager.getMinecraft();
      return toAccount(xboxManager, mcToken);
    } catch {
      return null;
    }
  }

  return { interactiveLogin, refresh };
}

module.exports = { createMicrosoftAuthProvider };
