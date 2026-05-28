'use strict';

const { app } = require('electron');

const { SYSTEM } = require('../../shared/ipcChannels');

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function registerSystemHandlers({ ipcMain, shell }) {
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
}

module.exports = { registerSystemHandlers };
