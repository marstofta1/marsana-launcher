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
const windowsManifestPath = path.join(root, 'docs', 'downloads', 'windows-manifest.json');
const macosManifestPath = path.join(root, 'docs', 'downloads', 'macos-manifest.json');
const linuxManifestPath = path.join(root, 'docs', 'downloads', 'linux-manifest.json');
const androidManifestPath = path.join(root, 'docs', 'downloads', 'android-manifest.json');
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

if (!fs.existsSync(windowsManifestPath)) {
  errors.push('docs/downloads/windows-manifest.json bulunamadı (prepare:win-downloads çalıştırın).');
} else {
  const manifest = JSON.parse(fs.readFileSync(windowsManifestPath, 'utf8'));
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

if (!fs.existsSync(macosManifestPath)) {
  errors.push('docs/downloads/macos-manifest.json bulunamadı (prepare:mac-downloads çalıştırın).');
} else {
  const manifest = JSON.parse(fs.readFileSync(macosManifestPath, 'utf8'));
  if (manifest.version !== version) {
    errors.push(`macos-manifest.json sürümü (${manifest.version}) package.json ile eşleşmiyor.`);
  }
  if (!manifest.sourceUrl) {
    errors.push('macos-manifest.json sourceUrl eksik.');
  }
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
    errors.push('macos-manifest.json platform listesi bos.');
  }
}

if (!fs.existsSync(linuxManifestPath)) {
  errors.push('docs/downloads/linux-manifest.json bulunamadı (prepare:linux-downloads çalıştırın).');
} else {
  const manifest = JSON.parse(fs.readFileSync(linuxManifestPath, 'utf8'));
  if (manifest.version !== version) {
    errors.push(`linux-manifest.json sürümü (${manifest.version}) package.json ile eşleşmiyor.`);
  }
  if (!manifest.sourceUrl) {
    errors.push('linux-manifest.json sourceUrl eksik.');
  }
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
    errors.push('linux-manifest.json platform listesi bos.');
  }
}

if (!fs.existsSync(androidManifestPath)) {
  errors.push('docs/downloads/android-manifest.json bulunamadı (prepare:android-downloads çalıştırın).');
} else {
  const manifest = JSON.parse(fs.readFileSync(androidManifestPath, 'utf8'));
  if (manifest.version !== version) {
    errors.push(`android-manifest.json sürümü (${manifest.version}) package.json ile eşleşmiyor.`);
  }
  if (!manifest.sourceUrl) {
    errors.push('android-manifest.json sourceUrl eksik.');
  }
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
    errors.push('android-manifest.json platform listesi bos.');
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
  if (!html.includes('macos-download-grid')) {
    errors.push('docs/index.html macOS indirme grid\'i içermiyor.');
  }
  if (!html.includes('download-macos.js')) {
    errors.push('docs/index.html download-macos.js script\'i içermiyor.');
  }
  if (!html.includes('linux-download-grid')) {
    errors.push('docs/index.html Linux indirme grid\'i içermiyor.');
  }
  if (!html.includes('download-linux.js')) {
    errors.push('docs/index.html download-linux.js script\'i içermiyor.');
  }
  if (!html.includes('android-download-grid')) {
    errors.push('docs/index.html Android indirme grid\'i içermiyor.');
  }
  if (!html.includes('download-android.js')) {
    errors.push('docs/index.html download-android.js script\'i içermiyor.');
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
