'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const latestYmlPath = path.join(root, 'docs', 'downloads', 'latest.yml');
const indexPath = path.join(root, 'docs', 'index.html');
const exeName = `Marsana Launcher-${version}-win-x64.exe`;

const errors = [];

if (!fs.existsSync(latestYmlPath)) {
  errors.push('docs/downloads/latest.yml bulunamadı.');
} else {
  const yml = fs.readFileSync(latestYmlPath, 'utf8');
  if (!new RegExp(`^version:\\s*${version.replace(/\./g, '\\.')}\\s*$`, 'm').test(yml)) {
    errors.push(`latest.yml sürümü package.json (${version}) ile eşleşmiyor.`);
  }
  if (!yml.includes(exeName)) {
    errors.push(`latest.yml içinde ${exeName} yok.`);
  }
}

if (!fs.existsSync(path.join(root, 'docs', 'downloads', exeName))) {
  errors.push(`Kurucu dosyası eksik: docs/downloads/${exeName}`);
}

if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const encoded = encodeURIComponent(exeName);
  if (!html.includes(encoded) && !html.includes(exeName)) {
    errors.push(`docs/index.html indirme linki ${exeName} dosyasını göstermiyor.`);
  }
  if (!html.includes(`v${version}`)) {
    errors.push(`docs/index.html sürüm etiketi v${version} içermiyor.`);
  }
}

if (errors.length > 0) {
  console.error('Release doğrulaması başarısız:');
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  process.exit(1);
}

console.log(`Release doğrulaması OK (v${version}).`);
