'use strict';

const { app } = require('electron');

const { isWin } = require('../../shared/platform');
const { UPDATE } = require('../../shared/ipcChannels');

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

  const base = process.env.MARSANA_UPDATES_BASE_URL;
  if (base && String(base).trim()) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: String(base).replace(/\/$/, ''),
    });
  }

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

      let result = null;
      let checkFailed = false;
      let checkErrorMessage = '';
      try {
        result = await autoUpdater.checkForUpdates();
      } catch (err) {
        checkFailed = true;
        const raw = err && err.message ? err.message : String(err);
        if (/404|not found|latest\.yml/i.test(raw)) {
          checkErrorMessage = MANUAL_UPDATE_HINT;
        } else {
          checkErrorMessage = raw;
        }
      }

      const hasUpdate = !checkFailed && result && result.isUpdateAvailable === true;
      if (!hasUpdate) {
        if (checkFailed) {
          emit({ phase: 'error', message: checkErrorMessage || MANUAL_UPDATE_HINT, percent: null });
          return { ok: false, message: checkErrorMessage || MANUAL_UPDATE_HINT };
        }
        emit({ phase: 'relaunching', message: 'Yeni sürüm yok. Launcher yeniden başlatılıyor…', percent: null });
        await sleep(450);
        setImmediate(() => {
          app.relaunch();
          app.exit(0);
        });
        return { ok: true, willRelaunch: true };
      }

      const ver = result.updateInfo && result.updateInfo.version ? result.updateInfo.version : '';
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
