'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'src', 'renderer', 'index.html');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

// Kullaniciya gorunen etiket `displayVersion`'dan gelir; `version` (update-feed
// surumu) her kucuk guncellemede artar ama gorunur etiket yalniz normal/isimli
// surumlerde degisir. displayVersion yoksa version'a duseriz (normal davranis).
const displayVersion = pkg.displayVersion || pkg.version;

let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(
  /<img class="logo"[^>]*>/,
  '<img class="logo" src="assets/logo.png" width="44" height="44" alt="Marsana Launcher" />'
);

if (!html.includes('app-version')) {
  html = html.replace(
    '<span class="brand-name">Marsana Launcher</span>',
    `<span class="brand-name">Marsana Launcher <small class="app-version">v${displayVersion}</small></span>`
  );
} else {
  html = html.replace(
    /<small class="app-version">[^<]*<\/small>/,
    `<small class="app-version">v${displayVersion}</small>`
  );
}

fs.writeFileSync(htmlPath, html);
console.log('Logo + version synced. görünür etiket:', displayVersion, '| iç sürüm:', pkg.version);
