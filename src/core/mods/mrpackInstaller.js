'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

const { LauncherError, Codes } = require('../infra/errors');
const { assertInside, extractZipInside } = require('../infra/safeZip');

// Paket içindeki hedef yollar uzak kaynaktan gelir (modrinth.index.json ve zip
// girdileri). Yazmadan önce çözülmüş hedefin gameRoot altında kaldığı doğrulanır;
// "../" ya da mutlak yol içeren girdiler oyun klasörünün dışına çıkabilirdi.
// Kontrolün kendisi infra/safeZip.js içinde, tek noktada tutulur.
function assertInsideGameRoot(gameRoot, relativePath) {
  return assertInside(
    gameRoot,
    relativePath,
    `Mod paketi güvenli değil: "${relativePath}" oyun klasörünün dışına yazmaya çalışıyor.`
  );
}

function installOverrides(zip, gameRoot) {
  extractZipInside(zip, gameRoot, {
    stripPrefix: 'overrides/',
    unsafeMessage: (rel) =>
      `Mod paketi güvenli değil: "${rel}" oyun klasörünün dışına yazmaya çalışıyor.`,
  });
}

function createMrpackInstaller({ httpClient, modrinthClient }) {
  async function installFromProject({ projectSlug, gameVersion, gameRoot, emit }) {
    let fileInfo;
    try {
      fileInfo = await modrinthClient.latestPrimaryFile(projectSlug, {
        loaders: ['fabric'],
        gameVersions: [gameVersion],
      });
    } catch (e) {
      if (e && e.code === Codes.MODRINTH_NOT_FOUND) {
        throw new LauncherError(
          Codes.MODRINTH_NOT_FOUND,
          `OptiFine paketi "${gameVersion}" sürümü için Modrinth'te bulunamadı. Başka bir Minecraft sürümü deneyin.`
        );
      }
      throw e;
    }

    // Sunucudan gelen dosya adı yol bileşeni içerebilir; sadece son parçası kullanılır.
    const safeFileName = path.basename(String(fileInfo.filename || ''));
    if (!safeFileName.toLowerCase().endsWith('.mrpack')) {
      throw new LauncherError(
        Codes.UNSUPPORTED_VERSION,
        'OptiFine paketi beklenen .mrpack biçiminde değil.'
      );
    }

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'marsana-mrpack-'));
    const mrpackPath = path.join(tmpDir, safeFileName);

    try {
      if (emit) emit.status({ text: 'OptiFine mod paketi indiriliyor…' });
      // .mrpack kabının kendisini Modrinth'in yayınladığı sha512/boyutla doğrula.
      await httpClient.download(fileInfo.url, mrpackPath, modrinthClient.fileIntegrity(fileInfo));

      const zip = new AdmZip(mrpackPath);
      const indexEntry = zip.getEntry('modrinth.index.json');
      if (!indexEntry) {
        throw new LauncherError(Codes.FILESYSTEM, 'Mod paketi geçersiz: modrinth.index.json yok.');
      }

      const index = JSON.parse(indexEntry.getData().toString('utf8'));
      const files = index.files || [];
      const installedPaths = [];
      let done = 0;

      for (const spec of files) {
        const rel = spec.path;
        if (!rel || !spec.downloads || !spec.downloads[0]) continue;
        const dest = assertInsideGameRoot(gameRoot, rel);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        // modrinth.index.json her dosya için hashes ve fileSize (camelCase!) verir.
        const integrity = {};
        if (spec.hashes) {
          if (spec.hashes.sha512) integrity.sha512 = spec.hashes.sha512;
          if (spec.hashes.sha1) integrity.sha1 = spec.hashes.sha1;
        }
        if (Number.isFinite(spec.fileSize)) integrity.size = spec.fileSize;
        await httpClient.download(spec.downloads[0], dest, integrity);
        installedPaths.push(rel);
        done += 1;
        if (emit && (done === files.length || done % 10 === 0)) {
          emit.status({ text: `OptiFine modları kuruluyor… (${done}/${files.length})` });
        }
      }

      if (emit) emit.status({ text: 'OptiFine yapılandırma dosyaları uygulanıyor…' });
      installOverrides(zip, gameRoot);

      const jarNames = installedPaths
        .filter((p) => p.startsWith('mods/') && p.endsWith('.jar'))
        .map((p) => path.basename(p));

      return {
        packName: index.name || projectSlug,
        packVersion: index.versionId || index.version || null,
        fileCount: files.length,
        jarNames,
      };
    } finally {
      try {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  return { installFromProject };
}

module.exports = { createMrpackInstaller };
