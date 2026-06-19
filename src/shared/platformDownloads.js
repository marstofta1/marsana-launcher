/** Marsana Launcher indirme sayfasi ve platform baglantilari (renderer + docs). */

export const DOWNLOADS_BASE = 'https://marstofta1.github.io/marsana-launcher/';
export const MOBILE_BASE = 'https://marstofta1.github.io/marsana-launcher/mobile/';
export const GITHUB_RELEASES = 'https://github.com/marstofta1/marsana-launcher/releases';

export const PLATFORM_DOWNLOADS = Object.freeze([
  {
    id: 'windows',
    native: 'win32',
    icon: '🪟',
    labelKey: 'platforms.windows',
    descKey: 'platforms.windowsDesc',
    url: `${DOWNLOADS_BASE}#windows-download-grid`,
  },
  {
    id: 'macos',
    native: 'darwin',
    icon: '🍎',
    labelKey: 'platforms.macos',
    descKey: 'platforms.macosDesc',
    url: `${DOWNLOADS_BASE}#macos-download-grid`,
  },
  {
    id: 'linux',
    native: 'linux',
    icon: '🐧',
    labelKey: 'platforms.linux',
    descKey: 'platforms.linuxDesc',
    url: `${DOWNLOADS_BASE}#linux-download-grid`,
  },
  {
    id: 'android',
    native: 'android',
    icon: '🤖',
    labelKey: 'platforms.android',
    descKey: 'platforms.androidDesc',
    url: `${DOWNLOADS_BASE}#android-download-grid`,
  },
  {
    id: 'ios',
    native: 'ios',
    icon: '📱',
    labelKey: 'platforms.ios',
    descKey: 'platforms.iosDesc',
    url: `${DOWNLOADS_BASE}#ios-download-grid`,
  },
  {
    id: 'mobileWeb',
    native: 'mobileWeb',
    icon: '🌐',
    labelKey: 'platforms.mobileWeb',
    descKey: 'platforms.mobileWebDesc',
    url: MOBILE_BASE,
  },
]);

export function otherPlatformDownloads(currentNative) {
  const cur = String(currentNative || '').trim();
  return PLATFORM_DOWNLOADS.filter((p) => p.native !== cur);
}

export function nativePlatformLabelKey(native) {
  const hit = PLATFORM_DOWNLOADS.find((p) => p.native === native);
  return hit ? hit.labelKey : 'platforms.current';
}
