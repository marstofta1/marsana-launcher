const api = window.api;

if (!api) {
  throw new Error('Preload API yüklenmedi. (window.api missing)');
}

export const auth = api.auth;
export const versions = api.versions;
export const servers = api.servers;
export const launch = api.launch;
export const openExternal = api.openExternal;
export const applyModIsolation = api.applyModIsolation;
export const app = api.app;
export const updates = api.updates;
export const roblox = api.roblox;

export const events = {
  onProgress: (handler) => api.on(api.channels.PROGRESS, handler),
  onStatus: (handler) => api.on(api.channels.STATUS, handler),
  onStdout: (handler) => api.on(api.channels.STDOUT, handler),
  onClose: (handler) => api.on(api.channels.CLOSE, handler),
};
