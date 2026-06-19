'use strict';

const AUTH = Object.freeze({
  LOGIN: 'auth:login',
  CURRENT: 'auth:current',
  LOGOUT: 'auth:logout',
  REFRESH: 'auth:refresh',
});

const VERSIONS = Object.freeze({
  LIST: 'versions:list',
  LEGACY_FABRIC_SUPPORTED: 'versions:legacyFabricSupported',
  LOADER_SUPPORTED: 'versions:loaderSupported',
});

const LAUNCH = Object.freeze({
  START: 'launch:start',
});

const SERVERS = Object.freeze({
  LIST: 'servers:list',
});

const EVENTS = Object.freeze({
  PROGRESS: 'launcher:progress',
  STATUS: 'launcher:status',
  STDOUT: 'launcher:stdout',
  CLOSE: 'launcher:close',
});

const SYSTEM = Object.freeze({
  OPEN_EXTERNAL: 'system:openExternal',
  GET_VERSION: 'system:getVersion',
  GET_PLATFORM: 'system:getPlatform',
  APPLY_MOD_ISOLATION: 'system:applyModIsolation',
});

const UPDATE = Object.freeze({
  CHECK: 'update:check',
  RUN: 'update:run',
  PHASE: 'launcher:updatePhase',
});

const RENDERER_EVENT_CHANNELS = Object.freeze([
  EVENTS.PROGRESS,
  EVENTS.STATUS,
  EVENTS.STDOUT,
  EVENTS.CLOSE,
  UPDATE.PHASE,
]);

const ROBLOX = Object.freeze({
  GET_ACCOUNT: 'roblox:getAccount',
  SAVE_ACCOUNT: 'roblox:saveAccount',
  CLEAR_ACCOUNT: 'roblox:clearAccount',
  SIGNUP_URL: 'roblox:signupUrl',
});

module.exports = Object.freeze({
  AUTH,
  VERSIONS,
  LAUNCH,
  SERVERS,
  EVENTS,
  SYSTEM,
  UPDATE,
  ROBLOX,
  RENDERER_EVENT_CHANNELS,
});
