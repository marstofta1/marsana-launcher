'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marsanaliz', {
  getApiBase: () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('apiBase') || 'http://127.0.0.1:3847/api/v1';
  },
  updates: {
    check: () => ipcRenderer.invoke('marsanaliz:update-check'),
    run: () => ipcRenderer.invoke('marsanaliz:update-run'),
    onPhase: (cb) => {
      const channel = 'marsanaliz:update-phase';
      const handler = (_event, payload) => cb(payload);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
});
