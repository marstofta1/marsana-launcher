'use strict';

const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const { startAnalyticsServer } = require('./analyticsServer');
const { registerUpdateHandlers } = require('./updateHandlers');

const PORT = Number(process.env.MARSANA_ANALYTICS_PORT || 3847);
let mainWindow = null;
let serverCtx = null;

function bootLog(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'boot.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  } catch {
    /* ignore */
  }
}

function getWindow() {
  return mainWindow;
}

function resolveResource(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  return path.join(__dirname, '..', '..', '..', ...parts);
}

function resolveWindowIcon() {
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'docs', 'assets', 'logo.png'),
    path.join(__dirname, '..', '..', '..', 'build', 'icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function revealWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: true,
    center: true,
    backgroundColor: '#0d1116',
    title: 'MarsAnaliz',
    icon: resolveWindowIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on('did-finish-load', () => revealWindow(win));
  win.webContents.on('did-fail-load', (_event, code, description) => {
    bootLog(`did-fail-load ${code} ${description}`);
  });

  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

async function bootstrap() {
  const t0 = Date.now();
  bootLog('bootstrap start');

  const dataDir = path.join(app.getPath('userData'), 'analytics-data');
  const dashboardDir = app.isPackaged
    ? resolveResource('analytics-dashboard')
    : path.join(__dirname, '..', '..', '..', 'analytics');

  process.env.MARSANA_ANALYTICS_DATA_DIR = dataDir;
  registerUpdateHandlers({ ipcMain, getWindow });

  mainWindow = createMainWindow();
  await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
  revealWindow(mainWindow);
  bootLog(`splash shown +${Date.now() - t0}ms`);

  serverCtx = await startAnalyticsServer({
    port: PORT,
    dataDir,
    dashboardDir,
  });
  bootLog(`server ready +${Date.now() - t0}ms ${serverCtx.apiBase}`);

  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
      query: { apiBase: serverCtx.apiBase },
    });
  }
  revealWindow(mainWindow);
  bootLog(`main ui loaded +${Date.now() - t0}ms`);
}

function showStartupError(err) {
  const message = err?.message || String(err);
  bootLog(`bootstrap error: ${message}`);
  dialog.showErrorBox(
    'MarsAnaliz baslatilamadi',
    `${message}\n\nPort ${PORT} baska bir program tarafindan kullaniliyor olabilir. Gorev Yoneticisi'nden eski MarsAnaliz islemlerini kapatip tekrar deneyin.`
  );
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.marsana.analiz');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      revealWindow(mainWindow);
    } else {
      bootstrap().catch((err) => showStartupError(err));
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
