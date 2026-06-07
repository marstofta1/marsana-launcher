'use strict';

const path = require('path');

function resolveServerModulePath() {
  return path.join(__dirname, '..', 'analytics-server', 'server.js');
}

async function startAnalyticsServer(options) {
  const serverPath = options.serverModulePath || resolveServerModulePath();
  const { startAnalyticsServer: start } = require(serverPath);
  const port = options.port || 3847;
  const ctx = await start({
    port,
    dataDir: options.dataDir,
    dashboardDir: options.dashboardDir,
  });
  return {
    ...ctx,
    apiBase: `http://127.0.0.1:${ctx.port}/api/v1`,
  };
}

module.exports = { startAnalyticsServer };
