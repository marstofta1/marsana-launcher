'use strict';

class LauncherError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'LauncherError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

const Codes = Object.freeze({
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  VERSION_NOT_SELECTED: 'VERSION_NOT_SELECTED',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  NETWORK: 'NETWORK',
  HTTP: 'HTTP',
  FILESYSTEM: 'FILESYSTEM',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  MODRINTH_NOT_FOUND: 'MODRINTH_NOT_FOUND',
  FABRIC_UNSUPPORTED: 'FABRIC_UNSUPPORTED',
  FORGE_UNSUPPORTED: 'FORGE_UNSUPPORTED',
  OPTIFINE_UNAVAILABLE: 'OPTIFINE_UNAVAILABLE',
  JAVA_RUNTIME_UNAVAILABLE: 'JAVA_RUNTIME_UNAVAILABLE',
});

module.exports = { LauncherError, Codes };
