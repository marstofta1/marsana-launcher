'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const marsanalizPkg = JSON.parse(
  fs.readFileSync(path.join(root, 'marsanaliz', 'package.json'), 'utf8')
);
const version = marsanalizPkg.version;
const downloadsDir = path.join(root, 'docs', 'marsanaliz', 'downloads');
const distDir = path.join(root, 'marsanaliz', 'dist');

function syncDistArtifacts() {
  const exeName = `MarsAnaliz-${version}-win-x64.exe`;
  const distExe = path.join(distDir, exeName);
  if (!fs.existsSync(distExe)) {
    return null;
  }

  fs.mkdirSync(downloadsDir, { recursive: true });
  const destExe = path.join(downloadsDir, exeName);
  fs.copyFileSync(distExe, destExe);

  const distLatest = path.join(distDir, 'latest.yml');
  if (fs.existsSync(distLatest)) {
    fs.copyFileSync(distLatest, path.join(downloadsDir, 'latest.yml'));
  }

  const distBlockmap = `${distExe}.blockmap`;
  if (fs.existsSync(distBlockmap)) {
    fs.copyFileSync(distBlockmap, `${destExe}.blockmap`);
  }

  console.log(`[marsanaliz] dist -> docs/marsanaliz/downloads: ${exeName}`);
  return exeName;
}

function main() {
  const file = syncDistArtifacts();
  if (!file) {
    const fallback = path.join(downloadsDir, `MarsAnaliz-${version}-win-x64.exe`);
    if (!fs.existsSync(fallback)) {
      console.error(`MarsAnaliz kurucusu bulunamadi (v${version}). marsanaliz klasorunde npm run pack:win calistirin.`);
      process.exit(1);
    }
  }

  const exeName = file || `MarsAnaliz-${version}-win-x64.exe`;
  const manifest = {
    version,
    file: exeName,
    downloadName: `MarsAnaliz-${version}-Setup.exe`,
    note: 'Windows 64 bit admin analiz uygulamasi',
  };

  fs.mkdirSync(downloadsDir, { recursive: true });
  fs.writeFileSync(
    path.join(downloadsDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
  console.log(`[marsanaliz] manifest -> docs/marsanaliz/downloads/manifest.json (v${version})`);
}

main();
