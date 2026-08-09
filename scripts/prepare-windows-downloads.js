'use strict';

const fs = require('fs');
const path = require('path');

const { getAnalyticsDownloadUrl } = require('./analytics-public-config');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const downloadsDir = path.join(root, 'docs', 'downloads');
const distDir = path.join(root, 'dist');

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

/** electron-builder ciktisini indirme sitesi klasorune kopyala. */
function syncDistArtifacts() {
  const exeName = `Marsana Launcher-${version}-win-x64.exe`;
  const distExe = path.join(distDir, exeName);
  if (!fs.existsSync(distExe)) {
    return null;
  }

  fs.mkdirSync(downloadsDir, { recursive: true });
  const destExe = path.join(downloadsDir, exeName);
  fs.copyFileSync(distExe, destExe);

  const distBlockmap = `${distExe}.blockmap`;
  if (fs.existsSync(distBlockmap)) {
    fs.copyFileSync(distBlockmap, `${destExe}.blockmap`);
  }

  const distLatest = path.join(distDir, 'latest.yml');
  if (fs.existsSync(distLatest)) {
    fs.copyFileSync(distLatest, path.join(downloadsDir, 'latest.yml'));
  }

  console.log(`[windows] dist -> docs/downloads: ${exeName}`);
  return exeName;
}

function findSourceExe() {
  const synced = syncDistArtifacts();
  if (synced) return synced;

  const primary = path.join(downloadsDir, `Marsana Launcher-${version}-win-x64.exe`);
  if (fs.existsSync(primary)) return path.basename(primary);
  const fallback = path.join(downloadsDir, `Marsana Launcher-${version}-win10-x64.exe`);
  if (fs.existsSync(fallback)) return path.basename(fallback);
  return null;
}

// Sürdürülebilirlik (Y1): docs/downloads yalnizca GUNCEL Windows kurucusunu
// tutar. Eski surumlerin .exe/.blockmap dosyalari birikip Pages yayinini
// sisiriyordu (7.6GB, 1GB limitini asiyordu). Yeni surum eklenince eskiler
// otomatik budanir; manifest'ler, latest.yml ve guncel exe korunur.
function pruneOldWindowsInstallers(keepExe) {
  if (!fs.existsSync(downloadsDir)) return;
  const keep = new Set([keepExe, `${keepExe}.blockmap`]);
  for (const name of fs.readdirSync(downloadsDir)) {
    if (!/-win-x64\.exe(\.blockmap)?$/.test(name)) continue; // sadece win kurucu/blockmap
    if (keep.has(name)) continue;
    try {
      fs.unlinkSync(path.join(downloadsDir, name));
      console.log(`[windows] eski kurucu budandi: ${name}`);
    } catch {
      /* ignore */
    }
  }
}

function main() {
  const sourceFile = findSourceExe();
  if (!sourceFile) {
    console.error(`Kaynak Windows kurucusu bulunamadi (v${version}). Once pack:win calistirin.`);
    process.exit(1);
  }

  fs.mkdirSync(downloadsDir, { recursive: true });

  const analyticsDownloadUrl = getAnalyticsDownloadUrl();
  const manifest = {
    version,
    note: 'Resmi Windows 9 sürümü yayımlanmamıştır; Windows 10 sonrası Windows 11 gelmiştir.',
    source: sourceFile,
    ...(analyticsDownloadUrl ? { analyticsDownloadUrl } : {}),
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

  // Guncel kurucu yerine oturdu; eski surumleri buda (Pages sismesin).
  pruneOldWindowsInstallers(sourceFile);
}

main();
