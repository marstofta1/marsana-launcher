'use strict';

const fs = require('fs');
const path = require('path');

const { LauncherError, Codes } = require('../infra/errors');

const DOWNLOADS_PAGE = 'https://optifine.net/downloads';

// optifine.net'in `downloads` ve `adloadx` sayfalarındaki URL kalıpları yıllardır
// aynı. Anti-bot için tarayıcı User-Agent'ı şart; Referer ile token sayfasına
// gerçekçi bir akış gibi gözükmeli.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function createOptifineDownloader({ httpClient, paths }) {
  let pageCache = null;
  let pageCachedAt = 0;
  const PAGE_TTL_MS = 30 * 60 * 1000;

  async function loadDownloadsPage() {
    const now = Date.now();
    if (pageCache && now - pageCachedAt < PAGE_TTL_MS) return pageCache;
    pageCache = await httpClient.fetchText(DOWNLOADS_PAGE, {
      headers: { 'User-Agent': BROWSER_UA },
    });
    pageCachedAt = now;
    return pageCache;
  }

  // Sayfada her sürüm için bir `adloadx?f=OptiFine_<MC>_HD_U_<KEY>.jar` linki var.
  // İlk eşleşen, en yeni HD_U sürümüdür (sayfa zaten yeni → eski sıralı).
  // Aynı satırda `colForge` hücresinde OptiFine'ın derlendiği Forge sürümü yazıyor —
  // Forge installer'a bu spesifik sürümü ver, yoksa binary uyumsuzluk crash'i olur.
  async function findAdloadEntry(mcVersion) {
    const html = await loadDownloadsPage();
    const mcEsc = mcVersion.replace(/\./g, '\\.');
    // Preview olmayan (stable) sürümleri önce dene
    const stableRe = new RegExp(
      `adloadx\\?f=(OptiFine_${mcEsc}_HD_U_[A-Z][0-9]+\\.jar)[^<]*?</a></td>[\\s\\S]*?colForge'?>([^<]+)</td>`
    );
    const stable = stableRe.exec(html);
    if (stable) {
      return {
        filename: stable[1],
        adloadPath: `adloadx?f=${stable[1]}`,
        requiredForgeVersion: extractForgeVersion(stable[2]),
      };
    }
    // Stable yoksa preview de kabul et
    const previewRe = new RegExp(
      `adloadx\\?f=(preview_OptiFine_${mcEsc}_HD_U_[A-Z][0-9]+(?:_pre[0-9]+)?\\.jar)[^<]*?</a></td>[\\s\\S]*?colForge'?>([^<]+)</td>`
    );
    const preview = previewRe.exec(html);
    if (preview) {
      return {
        filename: preview[1],
        adloadPath: `adloadx?f=${preview[1]}`,
        requiredForgeVersion: extractForgeVersion(preview[2]),
      };
    }
    return null;
  }

  function extractForgeVersion(cellText) {
    const m = String(cellText || '').match(/Forge\s+([0-9]+(?:\.[0-9]+)+)/i);
    return m ? m[1] : null;
  }

  async function resolveDownloadUrl({ adloadPath, filename }) {
    const adloadUrl = `https://optifine.net/${adloadPath}`;
    const html = await httpClient.fetchText(adloadUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        Referer: DOWNLOADS_PAGE,
      },
    });
    // adloadx sayfası `downloadx?f=...&x=<token>` linkini doğrudan içeriyor.
    const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = html.match(new RegExp(`downloadx\\?f=${escaped}&x=([A-Za-z0-9]+)`));
    if (!m) {
      throw new LauncherError(
        Codes.OPTIFINE_UNAVAILABLE,
        'OptiFine token sayfası çözümlenemedi (anti-bot değişmiş olabilir).'
      );
    }
    return `https://optifine.net/downloadx?f=${filename}&x=${m[1]}`;
  }

  function cacheDir() {
    return path.join(paths.userDataDir, 'optifine-cache');
  }

  async function ensureJarFor({ mcVersion, emit }) {
    const entry = await findAdloadEntry(mcVersion);
    if (!entry) {
      throw new LauncherError(
        Codes.OPTIFINE_UNAVAILABLE,
        `OptiFine "${mcVersion}" sürümünü desteklemiyor. OptiFine en son 1.21.9'a kadar yayınlandı — ` +
          'daha eski bir sürüm seçin veya "Forge" (OptiFine\'sız) ile başlatın.'
      );
    }
    const dir = cacheDir();
    await fs.promises.mkdir(dir, { recursive: true });
    const dest = path.join(dir, entry.filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      return { jarPath: dest, filename: entry.filename, requiredForgeVersion: entry.requiredForgeVersion };
    }

    if (emit && emit.status) {
      emit.status({ text: `OptiFine indiriliyor (${entry.filename})...` });
    }
    const downloadUrl = await resolveDownloadUrl(entry);
    await httpClient.download(downloadUrl, dest);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1024) {
      try {
        await fs.promises.rm(dest, { force: true });
      } catch {
        /* ignore */
      }
      throw new LauncherError(
        Codes.OPTIFINE_UNAVAILABLE,
        'OptiFine indirildi ancak dosya geçersiz görünüyor (anti-bot tarafından engellenmiş olabilir).'
      );
    }
    return { jarPath: dest, filename: entry.filename, requiredForgeVersion: entry.requiredForgeVersion };
  }

  return { ensureJarFor };
}

module.exports = { createOptifineDownloader };
