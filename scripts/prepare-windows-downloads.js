'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const downloadsDir = path.join(root, 'docs', 'downloads');

const PLATFORMS = [
  {
    id: 'win11',
    title: 'Windows 11',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '64 bit · Tam destek · v' + version,
    minOs: 'Windows 11',
  },
  {
    id: 'win10',
    title: 'Windows 10',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '64 bit · Tam destek · v' + version,
    minOs: 'Windows 10',
  },
  {
    id: 'win81',
    title: 'Windows 8 / 8.1',
    badge: 'Uyumluluk',
    badgeClass: 'legacy',
    note: '64 bit · Win 10+ önerilir · v' + version,
    minOs: 'Windows 8.1',
  },
  {
    id: 'win7',
    title: 'Windows 7',
    badge: 'Sınırlı',
    badgeClass: 'legacy',
    note: '64 bit · Win 10+ önerilir · v' + version,
    minOs: 'Windows 7 SP1',
  },
];

function findSourceExe() {
  const primary = path.join(downloadsDir, `Marsana Launcher-${version}-win-x64.exe`);
  if (fs.existsSync(primary)) return path.basename(primary);
  const fallback = path.join(downloadsDir, `Marsana Launcher-${version}-win10-x64.exe`);
  if (fs.existsSync(fallback)) return path.basename(fallback);
  return null;
}

function main() {
  const sourceFile = findSourceExe();
  if (!sourceFile) {
    console.error(`Kaynak Windows kurucusu bulunamadi (v${version}). Once pack:win calistirin.`);
    process.exit(1);
  }

  fs.mkdirSync(downloadsDir, { recursive: true });

  const manifest = {
    version,
    note: 'Resmi Windows 9 sürümü yayımlanmamıştır; Windows 10 sonrası Windows 11 gelmiştir.',
    source: sourceFile,
    platforms: PLATFORMS.map((platform) => ({
      id: platform.id,
      title: platform.title,
      file: sourceFile,
      downloadName: `Marsana-Launcher-${version}-${platform.id}-Setup.exe`,
      badge: platform.badge,
      badgeClass: platform.badgeClass,
      note: platform.note,
      minOs: platform.minOs,
    })),
  };

  const manifestPath = path.join(downloadsDir, 'windows-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[windows] manifest -> ${path.relative(root, manifestPath)} (${manifest.platforms.length} platform)`);
}

main();
