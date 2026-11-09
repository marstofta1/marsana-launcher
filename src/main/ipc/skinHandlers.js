'use strict';

const { dialog } = require('electron');

const { SKINS } = require('../../shared/ipcChannels');

function registerSkinHandlers({ ipcMain, skinService, getWindow }) {
  ipcMain.handle(SKINS.STATE, () => skinService.getState());

  ipcMain.handle(SKINS.SELECT, (_event, payload) => {
    const p = payload || {};
    if (p.kind === 'preset') return skinService.selectPreset(String(p.id || ''));
    if (p.kind === 'custom') return skinService.selectCustom();
    return skinService.selectDefault();
  });

  // Dosya yolu renderer'dan alınmaz; seçim penceresi main process'te açılır.
  ipcMain.handle(SKINS.PICK_CUSTOM, async () => {
    const win = getWindow();
    const options = {
      title: 'Skin yükle',
      properties: ['openFile'],
      filters: [{ name: 'Minecraft skin (64x64 PNG)', extensions: ['png'] }],
    };
    const picked = win && !win.isDestroyed()
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled || !picked.filePaths[0]) return null;
    return skinService.importCustom(picked.filePaths[0]);
  });
}

module.exports = { registerSkinHandlers };
