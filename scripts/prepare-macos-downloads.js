'use strict';

const fs = require('fs');
const path = require('path');

const { getAnalyticsDownloadUrl } = require('./analytics-public-config');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const downloadsDir = path.join(root, 'docs', 'downloads');

/** GitHub'daki son macOS paketi (yerel .dmg yoksa kullanılır). */
const MACOS_RELEASE = process.env.MARSANA_MACOS_RELEASE || '0.1.27';
const GITHUB_REPO = 'marstofta1/marsana-launcher';

const PLATFORMS = [
  {
    id: 'mac15',
    title: 'macOS 15 Sequoia',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.dmg · Universal · v' + version,
    minOs: 'macOS 15',
  },
  {
    id: 'mac14',
    title: 'macOS 14 Sonoma',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.dmg · Universal · v' + version,
    minOs: 'macOS 14',
  },
  {
    id: 'mac13',
    title: 'macOS 13 Ventura',
    badge: 'Desteklenir',
    badgeClass: 'ready',
    note: '.dmg · Universal · v' + version,
    minOs: 'macOS 13',
  },
  {
    id: 'mac12',
    title: 'macOS 12 Monterey',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.dmg · Universal · v' + version,
    minOs: 'macOS 12',
  },
  {
    id: 'mac11',
    title: 'macOS 11 Big Sur',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.dmg · Universal · v' + version,
    minOs: 'macOS 11',
  },
];

function findLocalDmg() {
  const candidates = [
    `Marsana Launcher-${version}-mac.dmg`,
    `Marsana.Launcher-${version}-mac.dmg`,
    `Marsana Launcher-${MACOS_RELEASE}-mac.dmg`,
    `Marsana.Launcher-${MACOS_RELEASE}-mac.dmg`,
  ];
  for (const name of candidates) {
    if (fs.existsSync(path.join(downloadsDir, name))) {
      return { type: 'local', file: name, releaseVersion: version };
    }
  }
  return null;
}

function githubSource() {
  const file = `Marsana.Launcher-${MACOS_RELEASE}-mac.dmg`;
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${MACOS_RELEASE}/${file}`;
  return { type: 'remote', file, url, releaseVersion: MACOS_RELEASE };
}

function main() {
  fs.mkdirSync(downloadsDir, { recursive: true });

  const source = findLocalDmg() || githubSource();
  const href = source.type === 'local'
    ? `downloads/${source.file}`
    : source.url;

  const analyticsDownloadUrl = getAnalyticsDownloadUrl();
  const manifest = {
    version,
    releaseVersion: source.releaseVersion,
    note: 'Intel ve Apple Silicon (M1/M2/M3) için universal .dmg paketi. Gatekeeper uyarısı ilk açılışta normaldir.',
    source: source.file,
    sourceUrl: href,
    ...(analyticsDownloadUrl ? { analyticsDownloadUrl } : {}),
    sourceType: source.type,
    platforms: PLATFORMS.map((platform) => ({
      id: platform.id,
      title: platform.title,
      url: href,
      downloadName: `Marsana-Launcher-${version}-${platform.id}.dmg`,
      badge: platform.badge,
      badgeClass: platform.badgeClass,
      note: platform.note,
      minOs: platform.minOs,
    })),
  };

  const manifestPath = path.join(downloadsDir, 'macos-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[macos] manifest -> ${path.relative(root, manifestPath)} (${manifest.platforms.length} platform, ${source.type})`);
}

main();
