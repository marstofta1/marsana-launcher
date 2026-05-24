'use strict';

const { AUTH } = require('../../shared/ipcChannels');

function registerAuthHandlers({ ipcMain, authService }) {
  ipcMain.handle(AUTH.LOGIN, () => authService.login());
  ipcMain.handle(AUTH.CURRENT, () => authService.current());
  ipcMain.handle(AUTH.LOGOUT, () => authService.logout());
  ipcMain.handle(AUTH.REFRESH, () => authService.refreshIfPossible());
}

module.exports = { registerAuthHandlers };
