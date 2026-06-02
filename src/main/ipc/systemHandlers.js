'use strict';

const fs = require('fs');
const path = require('path');

const { app } = require('electron');

const { SYSTEM } = require('../../shared/ipcChannels');
const modIsolationService = require('../../core/mods/modIsolationService');
const marsanaClientModService = require('../../core/mods/marsanaClientModService');

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function registerSystemHandlers({ ipcMain, shell, paths }) {
  ipcMain.handle(SYSTEM.GET_VERSION, () => app.getVersion());

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
