'use strict';

const { AUTH } = require('../../shared/ipcChannels');

function registerAuthHandlers({ ipcMain, authService, analyticsService }) {
  ipcMain.handle(AUTH.LOGIN, async () => {
    const account = await authService.login();
    if (analyticsService) analyticsService.trackLogin();
    return account;
  });
  ipcMain.handle(AUTH.CURRENT, () => authService.current());
  ipcMain.handle(AUTH.LOGOUT, () => authService.logout());
  ipcMain.handle(AUTH.REFRESH, () => authService.refreshIfPossible());
}

module.exports = { registerAuthHandlers };
