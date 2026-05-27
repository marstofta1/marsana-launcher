'use strict';

const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

const WINDOW_DEFAULTS = Object.freeze({
  width: 1100,
  height: 680,
  minWidth: 900,
  minHeight: 560,
  backgroundColor: '#1b1f23',
});

function resolveWindowIcon() {
  const candidates = [
    path.join(__dirname, '..', 'renderer', 'assets', 'logo.png'),
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createMainWindow() {
  const win = new BrowserWindow({
    ...WINDOW_DEFAULTS,
    title: 'Marsana Launcher',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

module.exports = { createMainWindow };
