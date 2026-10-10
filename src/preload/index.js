'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const {
  AUTH,
  VERSIONS,
  LAUNCH,
  SERVERS,
  SYSTEM,
  MODS,
  UPDATE,
  RENDERER_EVENT_CHANNELS,
} = require('../shared/ipcChannels');

const allowedEventChannels = new Set(RENDERER_EVENT_CHANNELS);

const api = Object.freeze({
  auth: Object.freeze({
    login: (method) => ipcRenderer.invoke(AUTH.LOGIN, method),
    current: () => ipcRenderer.invoke(AUTH.CURRENT),
    logout: () => ipcRenderer.invoke(AUTH.LOGOUT),
    refresh: () => ipcRenderer.invoke(AUTH.REFRESH),
  }),
  versions: Object.freeze({
    list: (opts) => ipcRenderer.invoke(VERSIONS.LIST, opts),
    legacyFabricSupported: () => ipcRenderer.invoke(VERSIONS.LEGACY_FABRIC_SUPPORTED),
    loaderSupported: (loaderId) => ipcRenderer.invoke(VERSIONS.LOADER_SUPPORTED, loaderId),
  }),
  servers: Object.freeze({
    list: () => ipcRenderer.invoke(SERVERS.LIST),
  }),
  launch: (opts) => ipcRenderer.invoke(LAUNCH.START, opts),
  openExternal: (url) => ipcRenderer.invoke(SYSTEM.OPEN_EXTERNAL, url),
  applyModIsolation: (payload) => ipcRenderer.invoke(SYSTEM.APPLY_MOD_ISOLATION, payload),
  mods: Object.freeze({
    // Sürüklenen File nesnesinin disk yolu yalnızca preload'da okunabilir (File.path kaldırıldı).
    pathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file) || '';
      } catch {
        return '';
      }
    },
    add: (filePaths, selection) => ipcRenderer.invoke(MODS.ADD, { filePaths, selection }),
    pick: (selection) => ipcRenderer.invoke(MODS.PICK, selection),
    bulk: (payload) => ipcRenderer.invoke(MODS.BULK, payload),
    list: (selection) => ipcRenderer.invoke(MODS.LIST, selection),
    remove: (file) => ipcRenderer.invoke(MODS.REMOVE, file),
    setEnabled: (file, enabled) => ipcRenderer.invoke(MODS.SET_ENABLED, { file, enabled }),
  }),
  app: Object.freeze({
    getVersion: () => ipcRenderer.invoke(SYSTEM.GET_VERSION),
    getPlatform: () => ipcRenderer.invoke(SYSTEM.GET_PLATFORM),
  }),
  updates: Object.freeze({
    check: () => ipcRenderer.invoke(UPDATE.CHECK),
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
