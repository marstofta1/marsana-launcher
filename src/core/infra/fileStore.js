'use strict';

const fs = require('fs');
const path = require('path');

function createJsonFileStore({ filePath, mode = 0o600 }) {
  function readSync() {
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  function writeSync(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode });
    fs.renameSync(tmp, filePath);
  }

  function exists() {
    return fs.existsSync(filePath);
  }

  function removeSync() {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  return { readSync, writeSync, exists, removeSync, filePath };
}

module.exports = { createJsonFileStore };
