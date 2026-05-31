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

function registerLaunchHandlers({ ipcMain, launchService, analyticsService, getWindow }) {
  const emit = createRendererEmitter(getWindow);
  ipcMain.handle(LAUNCH.START, async (_event, opts) => {
    let gameTracked = false;
    const wrappedEmit = {
      ...emit,
      close: (info) => {
        if (gameTracked && analyticsService) {
          analyticsService.trackGameClose(info || {});
        }
        emit.close(info);
      },
    };
    const result = await launchService.launch(opts || {}, wrappedEmit);
    if (result && result.started && analyticsService) {
      analyticsService.trackGameLaunch({
        version: opts && opts.version,
        loader: opts && opts.selectedLoader,
      });
      gameTracked = true;
    }
    return result;
  });
}

module.exports = { registerLaunchHandlers };
