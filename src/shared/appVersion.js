'use strict';

function parseVersionParts(version) {
  return String(version)
    .replace(/^v/i, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
}

/** 1 if a > b, -1 if a < b, 0 if equal */
function compareVersionStrings(a, b) {
  const ap = parseVersionParts(a);
  const bp = parseVersionParts(b);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i += 1) {
    const av = ap[i] || 0;
    const bv = bp[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function isRemoteVersionNewer(remoteVersion, currentVersion) {
  return compareVersionStrings(remoteVersion, currentVersion) > 0;
}

module.exports = {
  parseVersionParts,
  compareVersionStrings,
  isRemoteVersionNewer,
};
