'use strict';

const path = require('path');
const fs = require('fs');

function createPaths({ userDataDir }) {
  const authFile = path.join(userDataDir, 'auth.json');
  const gameRoot = path.join(userDataDir, 'minecraft');
  const logsDir = path.join(userDataDir, 'logs');
  const javaRuntimesDir = path.join(userDataDir, 'java-runtimes');

  function ensureBaseDirs() {
    for (const d of [userDataDir, gameRoot, logsDir, javaRuntimesDir]) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }
  }

  return Object.freeze({
    userDataDir,
    authFile,
    gameRoot,
    logsDir,
    javaRuntimesDir,
    ensureBaseDirs,
  });
}

module.exports = { createPaths };
