'use strict';

const { registerAuthHandlers } = require('./authHandlers');
const { registerVersionHandlers } = require('./versionHandlers');
const { registerLaunchHandlers } = require('./launchHandlers');
const { registerServerHandlers } = require('./serverHandlers');
const { registerSystemHandlers } = require('./systemHandlers');
const { registerUpdateHandlers } = require('./updateHandlers');

function registerAllHandlers({ ipcMain, shell, container, getWindow }) {
  registerAuthHandlers({
    ipcMain,
    authService: container.authService,
    analyticsService: container.analyticsService,
  });
  registerVersionHandlers({
    ipcMain,
    versionService: container.versionService,
    loaderSupport: container.loaderSupport,
  });
  registerLaunchHandlers({
    ipcMain,
    launchService: container.launchService,
    analyticsService: container.analyticsService,
    getWindow,
  });
  registerServerHandlers({
    ipcMain,
    recommendedServersService: container.recommendedServersService,
  });
  registerSystemHandlers({ ipcMain, shell });
  registerUpdateHandlers({ ipcMain, getWindow });
}

module.exports = { registerAllHandlers };
