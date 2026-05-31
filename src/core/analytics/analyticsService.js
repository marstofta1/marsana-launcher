'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const HEARTBEAT_MS = 3 * 60 * 1000;

function readEndpoint() {
  if (process.env.MARSANA_ANALYTICS_URL) {
    return String(process.env.MARSANA_ANALYTICS_URL).replace(/\/$/, '');
  }
  try {
    const configPath = app.isPackaged
      ? path.join(process.resourcesPath, 'analytics-config.json')
      : path.join(__dirname, '..', '..', '..', 'analytics-config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.enabled === false) return '';
      if (cfg.endpoint) return String(cfg.endpoint).replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }
  return '';
}

function createAnalyticsService({ userDataDir, getAccount, getLauncherVersion, logger }) {
  const identityPath = path.join(userDataDir, 'marsana-analytics-id.json');
  let installId = null;
  let sessionStartedAt = null;
  let gameStartedAt = null;
  let heartbeatTimer = null;
  let endpoint = '';

  function loadInstallId() {
    if (installId) return installId;
    try {
      if (fs.existsSync(identityPath)) {
        const raw = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
        if (raw && raw.installId) {
          installId = raw.installId;
          return installId;
        }
      }
    } catch {
      /* new id */
    }
    installId = crypto.randomUUID();
    fs.writeFileSync(identityPath, JSON.stringify({ installId, createdAt: Date.now() }, null, 2), 'utf8');
    return installId;
  }

  function playerContext() {
    const account = typeof getAccount === 'function' ? getAccount() : null;
    return {
      playerName: account && account.name ? account.name : null,
      playerUuid: account && account.uuid ? account.uuid : null,
    };
  }

  async function send(type, extra = {}) {
    if (!endpoint) return;
    const body = {
      installId: loadInstallId(),
      type,
      launcherVersion: typeof getLauncherVersion === 'function' ? getLauncherVersion() : null,
      platform: process.platform,
      ...playerContext(),
      ...extra,
    };
    try {
      await fetch(`${endpoint}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (logger) logger.debug('Analytics gonderilemedi', { type, err: err.message });
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      send('heartbeat', { activeSeconds: sessionStartedAt ? Math.floor((Date.now() - sessionStartedAt) / 1000) : 0 });
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function start() {
    endpoint = readEndpoint();
    if (!endpoint) {
      if (logger) logger.info('Analytics kapali (endpoint yapilandirilmadi)');
      return;
    }
    loadInstallId();
    sessionStartedAt = Date.now();
    send('first_open');
    send('session_start');
    startHeartbeat();
  }

  function stop() {
    if (!endpoint || !sessionStartedAt) return;
    const activeSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
    send('session_end', { activeSeconds });
    stopHeartbeat();
    sessionStartedAt = null;
  }

  function trackGameLaunch(meta = {}) {
    gameStartedAt = Date.now();
    send('game_launch', { payload: meta });
  }

  function trackGameClose(meta = {}) {
    const playSeconds = gameStartedAt ? Math.floor((Date.now() - gameStartedAt) / 1000) : 0;
    send('game_close', { playSeconds, payload: meta });
    gameStartedAt = null;
  }

  function trackLogin() {
    send('login');
  }

  return {
    start,
    stop,
    trackGameLaunch,
    trackGameClose,
    trackLogin,
    isEnabled: () => Boolean(endpoint),
  };
}

module.exports = { createAnalyticsService };
