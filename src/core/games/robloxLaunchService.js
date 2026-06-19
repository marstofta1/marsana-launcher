'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { shell } = require('electron');
const { LauncherError, Codes } = require('../infra/errors');

const ROBLOX_SIGNUP_URL = 'https://www.roblox.com/CreateAccount?locale=en_us';
const ROBLOX_HOME_PROTOCOL = 'roblox://';

function robloxVersionsDir() {
  return path.join(os.homedir(), 'AppData', 'Local', 'Roblox', 'Versions');
}

function findRobloxPlayerExe() {
  const versionsDir = robloxVersionsDir();
  if (!fs.existsSync(versionsDir)) return null;
  let best = null;
  for (const entry of fs.readdirSync(versionsDir)) {
    if (!entry.startsWith('version-')) continue;
    const candidate = path.join(versionsDir, entry, 'RobloxPlayerBeta.exe');
    if (fs.existsSync(candidate)) {
      best = candidate;
    }
  }
  return best;
}

function applyAmericaLocaleSettings() {
  if (process.platform !== 'win32') return;
  try {
    const settingsDir = path.join(os.homedir(), 'AppData', 'Local', 'Roblox', 'ClientSettings');
    fs.mkdirSync(settingsDir, { recursive: true });
    const settingsPath = path.join(settingsDir, 'ClientAppSettings.json');
    let existing = {};
    if (fs.existsSync(settingsPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch {
        existing = {};
      }
    }
    const merged = {
      ...existing,
      DFFlagDebugDisableTelemetry: 'True',
      DFIntTaskSchedulerTargetFps: '60',
    };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch {
    /* best effort */
  }
}

function createRobloxLaunchService({ logger, robloxAccountStore }) {
  async function launch(emit, { username } = {}) {
    if (process.platform !== 'win32') {
      throw new LauncherError(
        Codes.ROBLOX_UNAVAILABLE,
        'Roblox yalnızca Windows üzerinden Marsana Launcher ile başlatılabilir.'
      );
    }

    const saved = robloxAccountStore.load();
    const resolvedUser = String(username || saved?.username || '').trim();

    if (!resolvedUser) {
      if (emit && emit.status) {
        emit.status({ text: 'Roblox hesabı yok — kayıt sayfası açılıyor (Amerika / en-US)...' });
      }
      await shell.openExternal(ROBLOX_SIGNUP_URL);
      throw new LauncherError(
        Codes.ROBLOX_ACCOUNT_REQUIRED,
        'Roblox hesabı kayıtlı değil. Açılan sayfada hesap oluştur, ardından Ayarlar → Roblox bölümünden kullanıcı adını kaydet ve tekrar Oyna.'
      );
    }

    if (!saved || saved.username !== resolvedUser) {
      robloxAccountStore.save({ username: resolvedUser, locale: 'en-us' });
    }

    applyAmericaLocaleSettings();

    const playerExe = findRobloxPlayerExe();
    if (emit && emit.status) {
      emit.status({ text: `Roblox başlatılıyor (${resolvedUser})...` });
    }

    if (playerExe) {
      await new Promise((resolve, reject) => {
        const child = spawn(playerExe, [], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
        child.on('error', reject);
        setTimeout(resolve, 400);
      });
      if (emit && emit.stdout) {
        emit.stdout(`[launcher] Roblox Player başlatıldı (${resolvedUser}).`);
      }
    } else {
      await shell.openExternal(ROBLOX_HOME_PROTOCOL);
      if (emit && emit.stdout) {
        emit.stdout('[launcher] Roblox Player bulunamadı — roblox:// protokolü denendi.');
      }
    }

    if (emit && emit.status) {
      emit.status({ text: `Roblox başlatıldı — ${resolvedUser} (bölge: Amerika / en-US).` });
    }
    if (logger) logger.info('Roblox launched', { username: resolvedUser });
    return { started: true, roblox: true, username: resolvedUser };
  }

  return { launch, signupUrl: ROBLOX_SIGNUP_URL, findRobloxPlayerExe };
}

module.exports = { createRobloxLaunchService, ROBLOX_SIGNUP_URL };
