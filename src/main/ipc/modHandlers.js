'use strict';

const { dialog } = require('electron');

const { MODS } = require('../../shared/ipcChannels');

function registerModHandlers({ ipcMain, userModService, getWindow }) {
  ipcMain.handle(MODS.ADD, (_event, payload) =>
    userModService.addFromPaths(payload && payload.filePaths, payload && payload.selection)
  );

  ipcMain.handle(MODS.PICK, async (_event, selection) => {
    const win = getWindow();
    const options = {
      title: 'Mod ekle',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Minecraft modu', extensions: ['jar', 'zip', 'mrpack'] }],
    };
    const picked = win && !win.isDestroyed()
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled) return [];
    return userModService.addFromPaths(picked.filePaths, selection);
  });

  ipcMain.handle(MODS.LIST, (_event, selection) => userModService.list(selection || {}));

  ipcMain.handle(MODS.REMOVE, (_event, file) => userModService.remove(file));

  // Toplu işlemler geri alınamayabilir (silme): iki ayrı onay penceresi, ikisinde de varsayılan "Hayır".
  ipcMain.handle(MODS.BULK, async (_event, payload) => {
    const p = payload || {};
    const win = getWindow();
    for (const message of [p.confirm, p.confirmAgain]) {
      const options = {
        type: 'warning',
        title: String(p.title || ''),
        message: String(message || ''),
        buttons: [String(p.yes || 'Evet'), String(p.no || 'Hayır')],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      };
      const answer = win && !win.isDestroyed()
        ? await dialog.showMessageBox(win, options)
        : await dialog.showMessageBox(options);
      if (answer.response !== 0) return { confirmed: false, count: 0 };
    }
    return { confirmed: true, count: userModService.bulk(p.action) };
  });

  ipcMain.handle(MODS.SET_ENABLED, (_event, payload) =>
    userModService.setEnabled(payload && payload.file, !!(payload && payload.enabled))
  );
}

module.exports = { registerModHandlers };
