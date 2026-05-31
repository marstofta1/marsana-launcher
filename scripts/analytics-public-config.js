'use strict';

const fs = require('fs');
const path = require('path');

function getAnalyticsDownloadUrl() {
  const root = path.join(__dirname, '..');
  const publicPath = path.join(root, 'docs', 'analytics-public.json');
  const cfgPath = path.join(root, 'analytics-config.json');

  try {
    if (fs.existsSync(publicPath)) {
      const pub = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
      if (pub.enabled === false) return '';
      if (pub.downloadEndpoint) return String(pub.downloadEndpoint).trim();
    }
  } catch {
    /* fallback */
  }

  try {
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.enabled === false || !cfg.endpoint) return '';
      return `${String(cfg.endpoint).replace(/\/$/, '')}/download`;
    }
  } catch {
    /* ignore */
  }

  return '';
}

module.exports = { getAnalyticsDownloadUrl };
