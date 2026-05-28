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

  async function downloadAgentJar(dest) {
    let lastError;
    for (const url of NILLOADER_DOWNLOAD_URLS) {
      try {
        await httpClient.download(url, dest);
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
