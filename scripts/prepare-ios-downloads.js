'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const downloadsDir = path.join(root, 'docs', 'downloads');

/** GitHub'daki son iOS paketi (yerel IPA yoksa kullanılır). */
const IOS_RELEASE = process.env.MARSANA_IOS_RELEASE || '0.1.24';
const GITHUB_REPO = 'marstofta1/marsana-launcher';

const PLATFORMS = [
  {
    id: 'ios18',
    title: 'iOS 18',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.ipa · Sideloadly/AltStore · v' + version,
    minOs: 'iOS 18',
  },
  {
    id: 'ios17',
    title: 'iOS 17',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.ipa · Sideloadly/AltStore · v' + version,
    minOs: 'iOS 17',
  },
  {
    id: 'ios16',
    title: 'iOS 16',
    badge: 'Desteklenir',
    badgeClass: 'ready',
    note: '.ipa · Sideloadly/AltStore · v' + version,
    minOs: 'iOS 16',
  },
  {
    id: 'ios15',
    title: 'iOS 15',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.ipa · Sideloadly/AltStore · v' + version,
    minOs: 'iOS 15',
  },
  {
    id: 'ios14',
    title: 'iOS 14',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.ipa · Sideloadly/AltStore · v' + version,
    minOs: 'iOS 14',
  },
];

function findLocalIpa() {
  const candidates = [
    `Marsana.Launcher-${version}-ios.ipa`,
    `Marsana Launcher-${version}-ios.ipa`,
    `Marsana.Launcher-${IOS_RELEASE}-ios.ipa`,
  ];
  for (const name of candidates) {
    if (fs.existsSync(path.join(downloadsDir, name))) {
      return { type: 'local', file: name, releaseVersion: version };
    }
  }
  return null;
}

function githubSource() {
  const file = `Marsana.Launcher-${IOS_RELEASE}-ios.ipa`;
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${IOS_RELEASE}/${file}`;
  return { type: 'remote', file, url, releaseVersion: IOS_RELEASE };
}

function main() {
  fs.mkdirSync(downloadsDir, { recursive: true });

  const source = findLocalIpa() || githubSource();
  const href = source.type === 'local'
    ? `downloads/${source.file}`
    : source.url;

  const manifest = {
    version,
    releaseVersion: source.releaseVersion,
    note: 'IPA dosyasi App Store disi sideload ile kurulur (Sideloadly, AltStore vb.). Apple hesabi gerekir.',
    source: source.file,
    sourceUrl: href,
    sourceType: source.type,
    platforms: PLATFORMS.map((platform) => ({
      id: platform.id,
      title: platform.title,
      url: href,
      downloadName: `Marsana-Launcher-${version}-${platform.id}.ipa`,
      badge: platform.badge,
      badgeClass: platform.badgeClass,
      note: platform.note,
      minOs: platform.minOs,
    })),
  };

  const manifestPath = path.join(downloadsDir, 'ios-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[ios] manifest -> ${path.relative(root, manifestPath)} (${manifest.platforms.length} sürüm, ${source.type})`);
}

main();
