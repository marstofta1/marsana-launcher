'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicPath = path.join(root, 'docs', 'analytics-public.json');
const outPath = path.join(root, 'analytics-config.json');

function main() {
  let pub = { enabled: true, eventEndpoint: '', downloadEndpoint: '' };
  try {
    if (fs.existsSync(publicPath)) {
      pub = { ...pub, ...JSON.parse(fs.readFileSync(publicPath, 'utf8')) };
    }
  } catch (err) {
    console.error('[analytics-config] docs/analytics-public.json okunamadi:', err.message);
    process.exit(1);
  }

  const endpoint = String(pub.eventEndpoint || pub.endpoint || '').replace(/\/$/, '');
  const cfg = {
    enabled: pub.enabled !== false && Boolean(endpoint),
    endpoint,
  };

  fs.writeFileSync(outPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log(`[analytics-config] ${outPath} -> ${cfg.enabled ? endpoint : '(kapali)'}`);
}

main();
