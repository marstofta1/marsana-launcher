'use strict';

const fs = require('fs');
const path = require('path');

// GitHub release'leri kaldırıldı; resmi artefakt repo.sleeping.town üzerinde.
const NILLOADER_DOWNLOAD_URLS = [
  'https://repo.sleeping.town/com/unascribed/nilloader/1.3.6/nilloader-1.3.6.jar',
  'https://repo.sleeping.town/com/unascribed/nilloader/1.3.5/nilloader-1.3.5.jar',
];
const NILLOADER_JAR_NAME = 'NilLoader.jar';

function createNilLoaderInstaller({ httpClient, paths }) {
  function agentJarPath(gameRoot) {
    return path.join(gameRoot || paths.gameRoot, NILLOADER_JAR_NAME);
  }

  // repo.sleeping.town bir Reposilite Maven'ı; her jar'ın yanında `<url>.sha1`
  // sidecar'ı sunar. NilLoader jar'ı `-javaagent` olarak ÇALIŞTIRILDIĞI için
  // doğrulamak değerli. sha1 URL'e özeldir (fallback'ler farklı SÜRÜMlerdir), o
  // yüzden her URL'in kendi sidecar'ı çekilir. Aynı-origin sidecar olduğundan bu
  // CDN/ayna bozulmasına ve kesik indirmeye karşı garanti verir (aktif MITM'e
  // değil; TLS onu ayrıca engeller). Sidecar yoksa doğrulamasız devam ("varsa
  // doğrula"); hash tutmazsa httpClient.download jar'ı reddeder.
  async function jarSha1(jarUrl) {
    try {
      const text = await httpClient.fetchText(`${jarUrl}.sha1`);
      const m = String(text).match(/\b[0-9a-f]{40}\b/i);
      return m ? m[0].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  async function downloadAgentJar(dest) {
    let lastError;
    for (const url of NILLOADER_DOWNLOAD_URLS) {
      try {
        const sha1 = await jarSha1(url);
        await httpClient.download(url, dest, sha1 ? { sha1 } : {});
        return url;
      } catch (err) {
        lastError = err;
        try {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
      }
    }
    throw lastError || new Error('NilLoader indirilemedi');
  }

  async function ensureAgentJar({ gameRoot, emit }) {
    const dest = agentJarPath(gameRoot);
    if (fs.existsSync(dest)) return dest;
    if (emit && emit.status) {
      emit.status({ text: 'NilLoader indiriliyor…' });
    }
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await downloadAgentJar(dest);
    return dest;
  }

  function javaAgentArg(jarPath) {
    const absolute = path.resolve(jarPath);
    const normalized = absolute.replace(/\\/g, '/');
    return `-javaagent:${normalized}`;
  }

  return { ensureAgentJar, javaAgentArg, agentJarPath };
}

module.exports = { createNilLoaderInstaller };
