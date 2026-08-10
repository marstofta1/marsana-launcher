'use strict';

const fs = require('fs');
const path = require('path');

const { app } = require('electron');

const { SYSTEM } = require('../../shared/ipcChannels');
const platformInfo = require('../../shared/platform');
const modIsolationService = require('../../core/mods/modIsolationService');
const marsanaClientModService = require('../../core/mods/marsanaClientModService');

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function resolveDisplayVersion() {
  // Kullanıcıya görünen sürüm etiketi `displayVersion`'dan gelir; yoksa gerçek
  // app sürümüne düşer. Güncelleme mantığı app.getVersion()'ı DOĞRUDAN kullanır
  // (updateHandlers/launcherInstall) — bu IPC yalnızca görünür etiket içindir,
  // böylece küçük güncellemede etiket sabit kalır (iç sürüm artsa bile).
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
    return pkg.displayVersion || app.getVersion();
  } catch {
    return app.getVersion();
  }
}

function registerSystemHandlers({ ipcMain, shell, paths }) {
  ipcMain.handle(SYSTEM.GET_VERSION, () => resolveDisplayVersion());

  ipcMain.handle(SYSTEM.GET_PLATFORM, () => platformInfo.platform);

  ipcMain.handle(SYSTEM.OPEN_EXTERNAL, (_event, url) => {
    try {
      const parsed = new URL(url);
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
      shell.openExternal(parsed.toString());
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(SYSTEM.APPLY_MOD_ISOLATION, (_event, payload) => {
    if (!paths || !paths.gameRoot) return { stashed: 0, restored: 0 };
    const playMode = payload && payload.playMode === 'client' ? 'client' : 'launcher';
    const modPresets = marsanaClientModService.sanitizeModPresetsForPlayMode(
      payload && payload.modPresets ? payload.modPresets : {},
      playMode
    );
    const modsDir = path.join(paths.gameRoot, 'mods');
    try {
      fs.mkdirSync(modsDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return modIsolationService.enforceModIsolation(modsDir, modPresets, playMode);
  });
}

module.exports = { registerSystemHandlers };
