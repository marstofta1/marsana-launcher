'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
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
  return path.join(__dirname, '..', '..', ...parts);
}

async function bootstrap() {
  const dataDir = path.join(app.getPath('userData'), 'analytics-data');
  const dashboardDir = resolveResource('analytics-dashboard');
  const serverDir = resolveResource('analytics-server');

  process.env.MARSANA_ANALYTICS_DATA_DIR = dataDir;

  serverCtx = await startAnalyticsServer({
    port: PORT,
    dataDir,
    dashboardDir: app.isPackaged ? dashboardDir : path.join(__dirname, '..', '..', 'analytics'),
    serverModulePath: app.isPackaged
      ? path.join(serverDir, 'server.js')
      : path.join(__dirname, '..', '..', 'analytics-server', 'server.js'),
  });

  registerUpdateHandlers({ ipcMain, getWindow });

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'MarsAnaliz',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
    query: { apiBase: serverCtx.apiBase },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (serverCtx && serverCtx.server) {
      serverCtx.server.close();
    }
  });
}
