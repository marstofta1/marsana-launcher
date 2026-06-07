'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'analytics-server');
const destDir = path.join(root, 'marsanaliz', 'src', 'analytics-server');

for (const file of ['server.js', 'store.js']) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  console.log(`[marsanaliz] synced ${file}`);
}
