'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const { startAnalyticsServer } = require('./analyticsServer');
const { registerUpdateHandlers } = require('./updateHandlers');

const PORT = Number(process.env.MARSANA_ANALYTICS_PORT || 3847);
let mainWindow = null;
let serverCtx = null;

function getWindow() {
  return mainWindow;
}

function resolveResource(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  return path.join(__dirname, '..', '..', '..', ...parts);
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'MarsAnaliz',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

async function bootstrap() {
  mainWindow = createMainWindow();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
    query: { apiBase: `http://127.0.0.1:${PORT}/api/v1`, boot: '1' },
  });

  const dataDir = path.join(app.getPath('userData'), 'analytics-data');
  const dashboardDir = app.isPackaged
    ? resolveResource('analytics-dashboard')
    : path.join(__dirname, '..', '..', '..', 'analytics');

  process.env.MARSANA_ANALYTICS_DATA_DIR = dataDir;

  serverCtx = await startAnalyticsServer({
    port: PORT,
    dataDir,
    dashboardDir,
  });

  registerUpdateHandlers({ ipcMain, getWindow });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
      query: { apiBase: serverCtx.apiBase },
    });
  }
}

function showStartupError(err) {
  const message = err?.message || String(err);
  dialog.showErrorBox(
    'MarsAnaliz baslatilamadi',
    `${message}\n\nPort ${PORT} baska bir program tarafindan kullaniliyor olabilir. Gorev Yoneticisi'nden eski MarsAnaliz islemini kapatip tekrar deneyin.`
  );
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    bootstrap().catch((err) => {
      console.error('[MarsAnaliz] bootstrap failed:', err);
      showStartupError(err);
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (serverCtx && serverCtx.server) {
      serverCtx.server.close();
    }
  });
}
