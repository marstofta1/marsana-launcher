'use strict';

const { SERVERS } = require('../../shared/ipcChannels');

function registerServerHandlers({ ipcMain, recommendedServersService }) {
  ipcMain.handle(SERVERS.LIST, () => recommendedServersService.list());
}

module.exports = { registerServerHandlers };
