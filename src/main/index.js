'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');

const { buildContainer } = require('./container');
const { createMainWindow } = require('./window');
const { registerAllHandlers } = require('./ipc');
const { isMac } = require('../shared/platform');

let mainWindow = null;
const getWindow = () => mainWindow;

function focusMainWindow() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function bootstrap() {
  const container = buildContainer({ userDataDir: app.getPath('userData') });
  registerAllHandlers({ ipcMain, shell, container, getWindow });

  app.whenReady().then(() => {
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('second-instance', () => {
    focusMainWindow();
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}
