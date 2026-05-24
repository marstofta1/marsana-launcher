'use strict';

const { VERSIONS } = require('../../shared/ipcChannels');

function registerVersionHandlers({ ipcMain, versionService, legacyFabricInstaller }) {
  ipcMain.handle(VERSIONS.LIST, () => versionService.list());
  ipcMain.handle(VERSIONS.LEGACY_FABRIC_SUPPORTED, async () => {
    try {
      return await legacyFabricInstaller.listSupportedGameVersions();
    } catch {
      return [];
    }
  });
}

module.exports = { registerVersionHandlers };
