'use strict';

const fs = require('fs');
const path = require('path');

const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
const logoPath = path.join(rendererDir, 'assets', 'logo.png');
const htmlPath = path.join(rendererDir, 'index.html');

const b64 = fs.readFileSync(logoPath).toString('base64');
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(
  /<img class="logo"[^>]*>/,
  `<img class="logo" src="data:image/png;base64,${b64}" width="44" height="44" alt="Marsana Launcher" />`
);

if (!html.includes('app-version')) {
  html = html.replace(
    '<span class="brand-name">Marsana Launcher</span>',
    '<span class="brand-name">Marsana Launcher <small class="app-version">v0.1.4</small></span>'
  );
}

fs.writeFileSync(htmlPath, html);
console.log('Logo embedded:', b64.length, 'base64 chars');
