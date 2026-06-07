'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_REMOTE_CONFIG_URL =
  'https://marstofta1.github.io/marsana-launcher/analytics-public.json';

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  const current = loadSettings();
  const next = { ...current, ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'apiBase') && !patch.apiBase) {
    delete next.apiBase;
  }
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

function isLocalEndpoint(url) {
  if (!url) return true;
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return true;
  }
}

function readBundledPublicConfig() {
  const candidates = [
    path.join(process.resourcesPath, 'analytics-public.json'),
    path.join(__dirname, '..', '..', '..', 'docs', 'analytics-public.json'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchRemotePublicConfig() {
  const settings = loadSettings();
  const configUrl = settings.configUrl || process.env.MARSANA_ANALYTICS_CONFIG_URL || DEFAULT_REMOTE_CONFIG_URL;
  try {
    const res = await fetch(configUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function endpointFromPublic(pub) {
  if (!pub || pub.enabled === false) return '';
  const endpoint = pub.eventEndpoint || pub.endpoint;
  return endpoint ? String(endpoint).replace(/\/$/, '') : '';
}

async function resolveApiBase() {
  const settings = loadSettings();
  if (settings.apiBase) {
    return String(settings.apiBase).replace(/\/$/, '');
  }

  const remote = await fetchRemotePublicConfig();
  const fromRemote = endpointFromPublic(remote);
  if (fromRemote) return fromRemote;

  const bundled = readBundledPublicConfig();
  const fromBundled = endpointFromPublic(bundled);
  if (fromBundled) return fromBundled;

  return 'http://127.0.0.1:3847/api/v1';
}

module.exports = {
  loadSettings,
  saveSettings,
  resolveApiBase,
  isLocalEndpoint,
  DEFAULT_REMOTE_CONFIG_URL,
  fetchRemotePublicConfig,
  endpointFromPublic,
};
