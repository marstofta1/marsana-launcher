'use strict';

const fs = require('fs');
const path = require('path');

const { assertPublishableVersion } = require('./resolve-release-version');

const root = path.join(__dirname, '..');
const version = assertPublishableVersion(
  JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
);
const latestYmlPath = path.join(root, 'docs', 'downloads', 'latest.yml');
const indexPath = path.join(root, 'docs', 'index.html');
const manifestPath = path.join(root, 'docs', 'downloads', 'windows-manifest.json');
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

if (!fs.existsSync(manifestPath)) {
  errors.push('docs/downloads/windows-manifest.json bulunamadı (prepare:win-downloads çalıştırın).');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== version) {
    errors.push(`windows-manifest.json sürümü (${manifest.version}) package.json ile eşleşmiyor.`);
  }
  for (const platform of manifest.platforms || []) {
    if (platform.file !== manifest.source) {
      errors.push(`Platform ${platform.id} beklenmeyen dosya: ${platform.file}`);
    }
  }
  const sourcePath = path.join(root, 'docs', 'downloads', manifest.source);
  if (!fs.existsSync(sourcePath)) {
    errors.push(`Windows kaynak kurucusu eksik: ${manifest.source}`);
  }
}

if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('windows-download-grid')) {
    errors.push('docs/index.html Windows indirme grid\'i içermiyor.');
  }
  if (!html.includes('download-windows.js')) {
    errors.push('docs/index.html download-windows.js script\'i içermiyor.');
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
