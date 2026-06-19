'use strict';

const { ROBLOX } = require('../../shared/ipcChannels');

function registerRobloxHandlers({ ipcMain, robloxAccountStore, robloxLaunchService }) {
  ipcMain.handle(ROBLOX.GET_ACCOUNT, () => robloxAccountStore.load());
  ipcMain.handle(ROBLOX.SAVE_ACCOUNT, (_event, payload) => {
    return robloxAccountStore.save(payload || {});
  });
  ipcMain.handle(ROBLOX.CLEAR_ACCOUNT, () => {
    robloxAccountStore.clear();
    return true;
  });
  ipcMain.handle(ROBLOX.SIGNUP_URL, () => robloxLaunchService.signupUrl);
}

module.exports = { registerRobloxHandlers };
