'use strict';

const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const { buildContainer } = require('./container');
const { createMainWindow } = require('./window');
const { registerAllHandlers } = require('./ipc');
const { isMac } = require('../shared/platform');

let mainWindow = null;
let container = null;
const getWindow = () => mainWindow;

function focusMainWindow() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function bootstrap() {
  const repoRoot = app.isPackaged
    ? path.join(process.resourcesPath)
    : path.join(__dirname, '..', '..');
  container = buildContainer({ userDataDir: app.getPath('userData'), repoRoot });
  registerAllHandlers({ ipcMain, shell, container, getWindow });

  app.whenReady().then(() => {
    mainWindow = createMainWindow();
    container.analyticsService.start().catch((err) => {
      container.logger.warn('Analytics baslatilamadi', { err: err.message });
    });
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

  app.on('before-quit', () => {
    if (container && container.analyticsService) {
      container.analyticsService.stop();
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}
