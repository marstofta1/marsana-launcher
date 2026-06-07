'use strict';

const fs = require('fs');
const path = require('path');

function readPublicConfig() {
  const root = path.join(__dirname, '..');
  const publicPath = path.join(root, 'docs', 'analytics-public.json');
  try {
    if (fs.existsSync(publicPath)) {
      return JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

function getEventEndpoint() {
  const pub = readPublicConfig();
  if (pub.enabled === false) return '';
  if (pub.eventEndpoint) return String(pub.eventEndpoint).replace(/\/$/, '');
  if (pub.endpoint) return String(pub.endpoint).replace(/\/$/, '');
  return '';
}

function getAnalyticsDownloadUrl() {
  const pub = readPublicConfig();
  if (pub.enabled === false) return '';
  if (pub.downloadEndpoint) return String(pub.downloadEndpoint).trim();
  const event = getEventEndpoint();
  return event ? `${event}/download` : '';
}

module.exports = { readPublicConfig, getEventEndpoint, getAnalyticsDownloadUrl };
