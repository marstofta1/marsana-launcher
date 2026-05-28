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

module.exports = Object.freeze({
  AUTH,
  VERSIONS,
  LAUNCH,
  SERVERS,
  EVENTS,
  SYSTEM,
  UPDATE,
  RENDERER_EVENT_CHANNELS,
});
