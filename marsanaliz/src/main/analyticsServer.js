'use strict';

const path = require('path');
const Module = require('module');

function loadAnalyticsServerModule(serverPath) {
  const appRoot = path.join(__dirname, '..', '..');
  const appNodeModules = path.join(appRoot, 'node_modules');
  if (!Module.globalPaths.includes(appNodeModules)) {
    Module.globalPaths.unshift(appNodeModules);
  }
  return require(serverPath);
}

async function startAnalyticsServer(options) {
  const serverPath = options.serverModulePath
    || path.join(__dirname, '..', '..', '..', 'analytics-server', 'server.js');
  const { startAnalyticsServer: start } = loadAnalyticsServerModule(serverPath);
  const port = options.port || 3847;
  const ctx = await start({
    port,
    dataDir: options.dataDir,
    dashboardDir: options.dashboardDir,
  });
  return {
    ...ctx,
    apiBase: `http://127.0.0.1:${port}/api/v1`,
  };
}

module.exports = { startAnalyticsServer };
