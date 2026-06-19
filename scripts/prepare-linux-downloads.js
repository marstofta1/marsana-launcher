'use strict';

const fs = require('fs');
const path = require('path');

const { getAnalyticsDownloadUrl } = require('./analytics-public-config');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const downloadsDir = path.join(root, 'docs', 'downloads');

/** GitHub'daki son Linux paketi (yerel AppImage yoksa kullanılır). */
const LINUX_RELEASE = process.env.MARSANA_LINUX_RELEASE || version;
const GITHUB_REPO = 'marstofta1/marsana-launcher';

const PLATFORMS = [
  {
    id: 'ubuntu',
    title: 'Ubuntu',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'mint',
    title: 'Linux Mint',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'debian',
    title: 'Debian',
    badge: 'Desteklenir',
    badgeClass: 'ready',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'fedora',
    title: 'Fedora',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'manjaro',
    title: 'Manjaro',
    badge: 'Desteklenir',
    badgeClass: 'ready',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'mxlinux',
    title: 'MX Linux',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'solus',
    title: 'Solus',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.AppImage · x86_64 · v' + version,
  },
  {
    id: 'elementary',
    title: 'Elementary OS',
    badge: 'Desteklenir',
    badgeClass: 'ready',
    note: '.AppImage · x86_64 · v' + version,
  },
];

function findLocalAppImage() {
  const candidates = [
    `Marsana Launcher-${version}-linux.AppImage`,
    `Marsana.Launcher-${version}-linux.AppImage`,
    `Marsana Launcher-${LINUX_RELEASE}-linux.AppImage`,
    `Marsana.Launcher-${LINUX_RELEASE}-linux.AppImage`,
  ];
  for (const name of candidates) {
    if (fs.existsSync(path.join(downloadsDir, name))) {
      return { type: 'local', file: name, releaseVersion: version };
    }
  }
  return null;
}

function githubSource() {
  const file = `Marsana.Launcher-${LINUX_RELEASE}-linux.AppImage`;
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${LINUX_RELEASE}/${file}`;
  return { type: 'remote', file, url, releaseVersion: LINUX_RELEASE };
}

function main() {
  fs.mkdirSync(downloadsDir, { recursive: true });

  const source = findLocalAppImage() || githubSource();
  const href = source.type === 'local'
    ? `downloads/${source.file}`
    : source.url;

  const analyticsDownloadUrl = getAnalyticsDownloadUrl();
  const manifest = {
    version,
    releaseVersion: source.releaseVersion,
    note: 'AppImage x86_64 — çoğu dağıtımda çalışır. İlk çalıştırmadan önce: chmod +x Marsana*.AppImage',
    source: source.file,
    sourceUrl: href,
    ...(analyticsDownloadUrl ? { analyticsDownloadUrl } : {}),
    sourceType: source.type,
    platforms: PLATFORMS.map((platform) => ({
      id: platform.id,
      title: platform.title,
      url: href,
      downloadName: `Marsana-Launcher-${version}-${platform.id}.AppImage`,
      badge: platform.badge,
      badgeClass: platform.badgeClass,
      note: platform.note,
    })),
  };

  const manifestPath = path.join(downloadsDir, 'linux-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[linux] manifest -> ${path.relative(root, manifestPath)} (${manifest.platforms.length} distro, ${source.type})`);
}

main();
