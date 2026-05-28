'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const rendererDir = path.join(rootDir, 'src', 'renderer');
const logoPath = path.join(rendererDir, 'assets', 'logo.png');
const htmlPath = path.join(rendererDir, 'index.html');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const b64 = fs.readFileSync(logoPath).toString('base64');
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(
  /<img class="logo"[^>]*>/,
  `<img class="logo" src="data:image/png;base64,${b64}" width="44" height="44" alt="Marsana Launcher" />`
);

if (!html.includes('app-version')) {
  html = html.replace(
    '<span class="brand-name">Marsana Launcher</span>',
    `<span class="brand-name">Marsana Launcher <small class="app-version">v${pkg.version}</small></span>`
  );
} else {
  html = html.replace(
    /<small class="app-version">[^<]*<\/small>/,
    `<small class="app-version">v${pkg.version}</small>`
  );
}

fs.writeFileSync(htmlPath, html);
console.log('Logo embedded:', b64.length, 'base64 chars');
console.log('App version label synced:', pkg.version);
