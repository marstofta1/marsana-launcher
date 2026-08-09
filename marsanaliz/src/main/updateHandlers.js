'use strict';

const { app } = require('electron');

const { resolveFeedUrl, isAllowedFeedUrl } = require('../shared/updateFeedUrl');

function parseVersionParts(version) {
  return String(version)
    .replace(/^v/i, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
}

function isRemoteVersionNewer(remoteVersion, currentVersion) {
  const remote = parseVersionParts(remoteVersion);
  const current = parseVersionParts(currentVersion);
  const len = Math.max(remote.length, current.length);
  for (let i = 0; i < len; i += 1) {
    if ((remote[i] || 0) > (current[i] || 0)) return true;
    if ((remote[i] || 0) < (current[i] || 0)) return false;
  }
  return false;
}

function registerUpdateHandlers({ ipcMain, getWindow, logger }) {
  const log = logger || console;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // MarsAnaliz derlemesi imzasız; bu doğrulama açılırsa güncelleme tamamen
  // bloklanır. Kalıcı çözüm imzalı CI derlemesi (Y4). O zamana kadar tek güven
  // noktası aşağıdaki sabitlenmiş besleme adresidir.
  if (process.platform === 'win32') autoUpdater.verifyUpdateCodeSignature = false;

  const rawBase =
    typeof process.env.MARSANALIZ_UPDATES_BASE_URL === 'string'
      ? process.env.MARSANALIZ_UPDATES_BASE_URL.trim()
      : '';
  const base = resolveFeedUrl(rawBase);
  // Reddedilen değerin kendisi loglanmaz: kimlik bilgisi veya kaçış dizisi taşıyabilir.
  if (rawBase && !isAllowedFeedUrl(rawBase)) {
    log.warn('MARSANALIZ_UPDATES_BASE_URL izinli bir adres değil, yoksayıldı.');
  }
  autoUpdater.setFeedURL({ provider: 'generic', url: base });

  const MANUAL_HINT =
    'Guncelleme sunucusuna ulasilamadi. Manuel indirme: https://marstofta1.github.io/marsana-launcher/marsanaliz/';

  async function probeUpdateAvailability() {
    if (!app.isPackaged) {
      return { ok: true, available: false, devMode: true, currentVersion: app.getVersion() };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      const remoteVersion = result?.updateInfo?.version || null;
      const available =
        result?.isUpdateAvailable === true &&
        !!remoteVersion &&
        isRemoteVersionNewer(remoteVersion, app.getVersion());
      return {
        ok: true,
        available,
        version: available ? remoteVersion : undefined,
        currentVersion: app.getVersion(),
        remoteVersion: remoteVersion || undefined,
      };
    } catch (err) {
      const raw = err?.message || String(err);
      const message = /404|not found|latest\.yml/i.test(raw) ? MANUAL_HINT : raw;
      return { ok: false, available: false, message, currentVersion: app.getVersion() };
    }
  }

  ipcMain.handle('marsanaliz:update-check', () => probeUpdateAvailability());

  ipcMain.handle('marsanaliz:update-run', async () => {
    const emit = (payload) => {
      const win = getWindow();
      if (win && !win.isDestroyed()) win.webContents.send('marsanaliz:update-phase', payload);
    };

    try {
      if (!app.isPackaged) {
        emit({ phase: 'uptodate', message: 'Gelistirme surumu — guncelleme yok.' });
        return { ok: true, upToDate: true };
      }

      emit({ phase: 'checking', message: 'Guncellemeler kontrol ediliyor…' });
      const probe = await probeUpdateAvailability();
      if (!probe.ok) {
        emit({ phase: 'error', message: probe.message || MANUAL_HINT });
        return { ok: false, message: probe.message };
      }
      if (!probe.available) {
        const current = probe.currentVersion || app.getVersion();
        emit({
          phase: 'uptodate',
          message: `Zaten en guncel surumdesiniz (v${current}).`,
        });
        return { ok: true, upToDate: true, currentVersion: current };
      }

      const ver = probe.version || '';
      emit({ phase: 'downloading', percent: 0, message: `Surum ${ver} indiriliyor…` });

      const onProgress = (p) => {
        emit({
          phase: 'downloading',
          percent: typeof p.percent === 'number' ? p.percent : null,
          message: typeof p.percent === 'number' ? `Indiriliyor: %${Math.floor(p.percent)}` : 'Indiriliyor…',
        });
      };
      autoUpdater.on('download-progress', onProgress);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.removeListener('download-progress', onProgress);
      }

      emit({ phase: 'installing', message: 'Kurulum icin yeniden baslatiliyor…', percent: 100 });
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return { ok: true, willInstall: true };
    } catch (e) {
      const msg = e?.message || String(e);
      emit({ phase: 'error', message: msg });
      return { ok: false, message: msg };
    }
  });
}

module.exports = { registerUpdateHandlers };
