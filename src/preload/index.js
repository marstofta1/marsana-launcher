'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const {
  AUTH,
  VERSIONS,
  LAUNCH,
  SERVERS,
  SYSTEM,
  UPDATE,
  RENDERER_EVENT_CHANNELS,
} = require('../shared/ipcChannels');

const allowedEventChannels = new Set(RENDERER_EVENT_CHANNELS);

const api = Object.freeze({
  auth: Object.freeze({
    login: () => ipcRenderer.invoke(AUTH.LOGIN),
    current: () => ipcRenderer.invoke(AUTH.CURRENT),
    logout: () => ipcRenderer.invoke(AUTH.LOGOUT),
    refresh: () => ipcRenderer.invoke(AUTH.REFRESH),
  }),
  versions: Object.freeze({
    list: () => ipcRenderer.invoke(VERSIONS.LIST),
    legacyFabricSupported: () => ipcRenderer.invoke(VERSIONS.LEGACY_FABRIC_SUPPORTED),
  }),
  servers: Object.freeze({
    list: () => ipcRenderer.invoke(SERVERS.LIST),
  }),
  launch: (opts) => ipcRenderer.invoke(LAUNCH.START, opts),
  openExternal: (url) => ipcRenderer.invoke(SYSTEM.OPEN_EXTERNAL, url),
  updates: Object.freeze({
    run: () => ipcRenderer.invoke(UPDATE.RUN),
    onPhase: (handler) => {
      const channel = UPDATE.PHASE;
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  }),
  on: (channel, handler) => {
    if (!allowedEventChannels.has(channel)) return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  channels: Object.freeze({
    PROGRESS: 'launcher:progress',
    STATUS: 'launcher:status',
    STDOUT: 'launcher:stdout',
    CLOSE: 'launcher:close',
    UPDATE_PHASE: UPDATE.PHASE,
  }),
});

contextBridge.exposeInMainWorld('api', api);
