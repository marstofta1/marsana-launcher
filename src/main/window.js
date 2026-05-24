'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

const WINDOW_DEFAULTS = Object.freeze({
  width: 1100,
  height: 680,
  minWidth: 900,
  minHeight: 560,
  backgroundColor: '#1b1f23',
});

function createMainWindow() {
  const win = new BrowserWindow({
    ...WINDOW_DEFAULTS,
    title: 'Marsana Launcher',
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
