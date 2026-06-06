'use strict';

const { app } = require('electron');

const { isWin } = require('../../shared/platform');
const { UPDATE } = require('../../shared/ipcChannels');

const DEFAULT_UPDATES_BASE_URL =
  'https://marstofta1.github.io/marsana-launcher/downloads';

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
    const rv = remote[i] || 0;
    const cv = current[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

function configureFeedUrl(autoUpdater) {
  const envBase = process.env.MARSANA_UPDATES_BASE_URL;
  const base =
    envBase && String(envBase).trim() ? String(envBase).trim() : DEFAULT_UPDATES_BASE_URL;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: base.replace(/\/$/, ''),
  });
}

function sendPhase(getWindow, payload) {
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(UPDATE.PHASE, payload);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function registerUpdateHandlers({ ipcMain, getWindow }) {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // İmzasız NSIS/generic güncellemeleri Windows'ta varsayılan doğrulamada bloklanabilir.
  if (isWin) autoUpdater.verifyUpdateCodeSignature = false;

  const MANUAL_UPDATE_HINT =
    'Güncelleme sunucusuna ulaşılamadı. GitHub Pages etkin olmalı ve repo herkese açık olmalıdır. ' +
    'Manuel indirme: https://github.com/marstofta1/marsana-launcher (docs/downloads).';

  configureFeedUrl(autoUpdater);

  async function probeUpdateAvailability() {
    if (!app.isPackaged) {
      return { ok: true, available: false, devMode: true };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      const remoteVersion =
        result && result.updateInfo && result.updateInfo.version
          ? result.updateInfo.version
          : null;
      const available =
        !!(result && result.isUpdateAvailable === true) &&
        !!remoteVersion &&
        isRemoteVersionNewer(remoteVersion, app.getVersion());
      const version = available ? remoteVersion : undefined;
      return {
        ok: true,
        available,
        version,
        currentVersion: app.getVersion(),
        remoteVersion: remoteVersion || undefined,
      };
    } catch (err) {
      const raw = err && err.message ? err.message : String(err);
      const message = /404|not found|latest\.yml/i.test(raw) ? MANUAL_UPDATE_HINT : raw;
      return { ok: false, available: false, message, currentVersion: app.getVersion() };
    }
  }

  ipcMain.handle(UPDATE.CHECK, () => probeUpdateAvailability());

  ipcMain.handle(UPDATE.RUN, async () => {
    const emit = (patch) => sendPhase(getWindow, patch);

    try {
      if (!app.isPackaged) {
        emit({ phase: 'checking', message: 'Geliştirme sürümü — güncelleme sunucusu kullanılmıyor.', percent: null });
        await sleep(400);
        emit({ phase: 'relaunching', message: 'Launcher yeniden başlatılıyor…', percent: null });
        await sleep(280);
        setImmediate(() => {
          app.relaunch();
          app.exit(0);
        });
        return { ok: true, willRelaunch: true };
      }

      emit({ phase: 'checking', message: 'Güncellemeler kontrol ediliyor…', percent: null });

      const probe = await probeUpdateAvailability();
      if (!probe.ok) {
        emit({ phase: 'error', message: probe.message || MANUAL_UPDATE_HINT, percent: null });
        return { ok: false, message: probe.message || MANUAL_UPDATE_HINT };
      }

      const hasUpdate = probe.available === true;
      if (!hasUpdate) {
        const current = probe.currentVersion || app.getVersion();
        const remote = probe.remoteVersion;
        const detail = remote && remote !== current
          ? `Sunucu: v${remote}, kurulu: v${current}`
          : `Kurulu sürüm: v${current}`;
        emit({
          phase: 'uptodate',
          message: `Zaten en güncel sürümdesiniz. ${detail}`,
          percent: null,
        });
        return {
          ok: true,
          upToDate: true,
          currentVersion: current,
          remoteVersion: remote,
          message: `Zaten en güncel sürümdesiniz. ${detail}`,
        };
      }

      const ver = probe.version || '';
      emit({
        phase: 'downloading',
        percent: 0,
        message: ver ? `Sürüm ${ver} indiriliyor…` : 'Güncelleme indiriliyor…',
      });

      const onProgress = (p) => {
        const pct = typeof p.percent === 'number' ? p.percent : null;
        emit({
          phase: 'downloading',
          percent: pct,
          message:
            pct != null ? `İndiriliyor: %${Math.floor(p.percent)}` : 'Güncelleme indiriliyor…',
        });
      };
      autoUpdater.on('download-progress', onProgress);

      try {
        await autoUpdater.downloadUpdate();
      } catch (err) {
        autoUpdater.removeListener('download-progress', onProgress);
        const msg = err && err.message ? err.message : String(err);
        emit({ phase: 'error', message: msg, percent: null });
        return { ok: false, message: msg };
      }
      autoUpdater.removeListener('download-progress', onProgress);

      emit({ phase: 'installing', message: 'Kurulum için yeniden başlatılıyor…', percent: 100 });
      await sleep(450);
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
      return { ok: true, willInstall: true };
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      emit({ phase: 'error', message: msg, percent: null });
      return { ok: false, message: msg };
    }
  });
}

module.exports = { registerUpdateHandlers };
