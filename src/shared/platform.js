'use strict';

const platform = process.platform;

module.exports = Object.freeze({
  platform,
  isMac: platform === 'darwin',
  isWin: platform === 'win32',
  isLinux: platform === 'linux',
});
