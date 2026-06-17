'use strict';

const { VERSIONS } = require('../../shared/ipcChannels');

function registerVersionHandlers({ ipcMain, versionService, loaderSupport }) {
  ipcMain.handle(VERSIONS.LIST, (_event, opts) => versionService.list(opts || {}));
  ipcMain.handle(VERSIONS.LEGACY_FABRIC_SUPPORTED, async () => {
    try {
      const fn = loaderSupport['legacy-fabric'];
      return fn ? await fn() : [];
    } catch {
      return [];
    }
  });
  ipcMain.handle(VERSIONS.LOADER_SUPPORTED, async (_event, loaderId) => {
    const fn = loaderSupport[loaderId];
    if (!fn) return null;
    try {
      return await fn();
    } catch {
      return [];
    }
  });
}

module.exports = { registerVersionHandlers };
