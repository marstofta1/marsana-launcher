'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

const { LauncherError, Codes } = require('../infra/errors');

// Paket içindeki hedef yollar uzak kaynaktan gelir (modrinth.index.json ve zip
// girdileri). Yazmadan önce çözülmüş hedefin gameRoot altında kaldığı doğrulanır;
// "../" ya da mutlak yol içeren girdiler oyun klasörünün dışına çıkabilirdi.
function resolveInside(rootDir, relativePath) {
  const root = path.resolve(rootDir);
  const dest = path.resolve(root, String(relativePath));
  const rel = path.relative(root, dest);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return dest;
}

function assertInside(rootDir, relativePath) {
  const dest = resolveInside(rootDir, relativePath);
  if (!dest) {
    throw new LauncherError(
      Codes.FILESYSTEM,
      `Mod paketi güvenli değil: "${relativePath}" oyun klasörünün dışına yazmaya çalışıyor.`
    );
  }
  return dest;
}

function installOverrides(zip, gameRoot) {
  const entries = zip.getEntries();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, '/');
    if (!name.startsWith('overrides/')) continue;
    const rel = name.slice('overrides/'.length);
    if (!rel) continue;
    const dest = assertInside(gameRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
  }
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
      await httpClient.download(fileInfo.url, mrpackPath);

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
        const dest = path.join(gameRoot, rel);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await httpClient.download(spec.downloads[0], dest);
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
