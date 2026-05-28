'use strict';

/** Ornithe 0.1.2 + Calamus: bu sürümlerde GUI init IllegalAccessError (upstream). */
const ORNITHE_BLOCKED_VERSIONS = Object.freeze(['1.13', '1.13.1', '1.13.2']);
const ORNITHE_BLOCKED_SET = new Set(ORNITHE_BLOCKED_VERSIONS);
const ORNITHE_SUGGESTED_VERSION = '1.12.2';

function isOrnitheVersionBlocked(versionId) {
  return ORNITHE_BLOCKED_SET.has(String(versionId || '').trim());
}

function ornitheBlockedVersionMessage(versionId) {
  const v = String(versionId || '').trim();
  return (
    `Ornithe Minecraft ${v} ile şu an çalışmıyor (bilinen Calamus hatası). ` +
    `Lütfen ${ORNITHE_SUGGESTED_VERSION} seçin.`
  );
}

module.exports = {
  ORNITHE_BLOCKED_VERSIONS,
  ORNITHE_BLOCKED_SET,
  ORNITHE_SUGGESTED_VERSION,
  isOrnitheVersionBlocked,
  ornitheBlockedVersionMessage,
};
