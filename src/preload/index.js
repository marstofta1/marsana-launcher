'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const {
  AUTH,
  VERSIONS,
  LAUNCH,
  SERVERS,
  SYSTEM,
  UPDATE,
  ROBLOX,
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
  roblox: Object.freeze({
    getAccount: () => ipcRenderer.invoke(ROBLOX.GET_ACCOUNT),
    saveAccount: (payload) => ipcRenderer.invoke(ROBLOX.SAVE_ACCOUNT, payload),
    clearAccount: () => ipcRenderer.invoke(ROBLOX.CLEAR_ACCOUNT),
    signupUrl: () => ipcRenderer.invoke(ROBLOX.SIGNUP_URL),
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
