'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const downloadsDir = path.join(root, 'docs', 'downloads');

/** GitHub'daki son Android paketi (yerel APK yoksa kullanılır). */
const ANDROID_RELEASE = process.env.MARSANA_ANDROID_RELEASE || '0.1.24';
const GITHUB_REPO = 'marstofta1/marsana-launcher';

const PLATFORMS = [
  {
    id: 'android16',
    title: 'Android 16',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.apk · Bedrock başlatıcı · v' + version,
    minOs: 'Android 16',
  },
  {
    id: 'android15',
    title: 'Android 15',
    badge: 'Önerilen',
    badgeClass: 'ready',
    note: '.apk · Bedrock başlatıcı · v' + version,
    minOs: 'Android 15',
  },
  {
    id: 'android14',
    title: 'Android 14',
    badge: 'Desteklenir',
    badgeClass: 'ready',
    note: '.apk · Bedrock başlatıcı · v' + version,
    minOs: 'Android 14',
  },
  {
    id: 'android13',
    title: 'Android 13',
    badge: 'Desteklenir',
    badgeClass: 'legacy',
    note: '.apk · Bedrock başlatıcı · v' + version,
    minOs: 'Android 13',
  },
];

function findLocalApk() {
  const candidates = [
    `Marsana.Launcher-${version}-android.apk`,
    `Marsana Launcher-${version}-android.apk`,
    `Marsana.Launcher-${ANDROID_RELEASE}-android.apk`,
  ];
  for (const name of candidates) {
    if (fs.existsSync(path.join(downloadsDir, name))) {
      return { type: 'local', file: name, releaseVersion: version };
    }
  }
  return null;
}

function githubSource() {
  const file = `Marsana.Launcher-${ANDROID_RELEASE}-android.apk`;
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${ANDROID_RELEASE}/${file}`;
  return { type: 'remote', file, url, releaseVersion: ANDROID_RELEASE };
}

function main() {
  fs.mkdirSync(downloadsDir, { recursive: true });

  const source = findLocalApk() || githubSource();
  const href = source.type === 'local'
    ? `downloads/${source.file}`
    : source.url;

  const manifest = {
    version,
    releaseVersion: source.releaseVersion,
    note: 'Mobil Marsana Launcher Bedrock (PE) başlatıcıdır. Bilinmeyen kaynaklardan kuruluma izin vermen gerekebilir.',
    source: source.file,
    sourceUrl: href,
    sourceType: source.type,
    platforms: PLATFORMS.map((platform) => ({
      id: platform.id,
      title: platform.title,
      url: href,
      downloadName: `Marsana-Launcher-${version}-${platform.id}.apk`,
      badge: platform.badge,
      badgeClass: platform.badgeClass,
      note: platform.note,
      minOs: platform.minOs,
    })),
  };

  const manifestPath = path.join(downloadsDir, 'android-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[android] manifest -> ${path.relative(root, manifestPath)} (${manifest.platforms.length} sürüm, ${source.type})`);
}

main();
