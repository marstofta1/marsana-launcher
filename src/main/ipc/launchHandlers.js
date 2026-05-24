'use strict';

const { LAUNCH, EVENTS } = require('../../shared/ipcChannels');

function createRendererEmitter(getWindow) {
  function send(channel, payload) {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
  return {
    progress: (p) => send(EVENTS.PROGRESS, p),
    status: (s) => send(EVENTS.STATUS, s),
    stdout: (line) => send(EVENTS.STDOUT, line),
    close: (info) => send(EVENTS.CLOSE, info),
  };
}

function registerLaunchHandlers({ ipcMain, launchService, getWindow }) {
  const emit = createRendererEmitter(getWindow);
  ipcMain.handle(LAUNCH.START, (_event, opts) => launchService.launch(opts || {}, emit));
}

module.exports = { registerLaunchHandlers };
