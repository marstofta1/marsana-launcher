'use strict';

const { registerAuthHandlers } = require('./authHandlers');
const { registerVersionHandlers } = require('./versionHandlers');
const { registerLaunchHandlers } = require('./launchHandlers');
const { registerServerHandlers } = require('./serverHandlers');
const { registerSystemHandlers } = require('./systemHandlers');
const { registerUpdateHandlers } = require('./updateHandlers');

function registerAllHandlers({ ipcMain, shell, container, getWindow }) {
  registerAuthHandlers({ ipcMain, authService: container.authService });
  registerVersionHandlers({
    ipcMain,
    versionService: container.versionService,
    legacyFabricInstaller: container.legacyFabricInstaller,
  });
  registerLaunchHandlers({ ipcMain, launchService: container.launchService, getWindow });
  registerServerHandlers({
    ipcMain,
    recommendedServersService: container.recommendedServersService,
  });
  registerSystemHandlers({ ipcMain, shell });
  registerUpdateHandlers({ ipcMain, getWindow });
}

module.exports = { registerAllHandlers };
