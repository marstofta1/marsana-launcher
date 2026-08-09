'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { LauncherError, Codes } = require('../infra/errors');
const { assertInside } = require('../infra/safeZip');

const FORGE_PROMOS_URL =
  'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

function installerJarUrl(mcVersion, forgeVersion) {
  const id = `${mcVersion}-${forgeVersion}`;
  return `https://maven.minecraftforge.net/net/minecraftforge/forge/${id}/forge-${id}-installer.jar`;
}

// Forge installer client profilini `versions/<MC>-forge-<FORGE>/...` veya benzer
// bir adla yazıyor; sürümler arası küçük farklar var. Aday isimleri sırayla dene.
function candidateVersionIds(mcVersion, forgeVersion) {
  return [
    `${mcVersion}-forge-${forgeVersion}`,
    `forge-${mcVersion}-${forgeVersion}`,
    `${mcVersion}-Forge${forgeVersion}`,
  ];
}

function findInstalledProfile(gameRoot, mcVersion, forgeVersion) {
  const versionsDir = path.join(gameRoot, 'versions');
  if (!fs.existsSync(versionsDir)) return null;
  const candidates = candidateVersionIds(mcVersion, forgeVersion);
  for (const id of candidates) {
    if (fs.existsSync(path.join(versionsDir, id, `${id}.json`))) return id;
  }
  // Fallback: forge & mc sürümünü içeren bir klasör var mı?
  for (const entry of fs.readdirSync(versionsDir)) {
    const lower = entry.toLowerCase();
    if (
      lower.includes(mcVersion.toLowerCase()) &&
      lower.includes('forge') &&
      lower.includes(forgeVersion.toLowerCase()) &&
      fs.existsSync(path.join(versionsDir, entry, `${entry}.json`))
    ) {
      return entry;
    }
  }
  return null;
}

function createForgeInstaller({ httpClient, paths }) {
  let promosCache = null;
  let promosCachedAt = 0;
  const PROMOS_TTL_MS = 60 * 60 * 1000;

  async function loadPromos() {
    const now = Date.now();
    if (promosCache && now - promosCachedAt < PROMOS_TTL_MS) return promosCache;
    const data = await httpClient.fetchJson(FORGE_PROMOS_URL);
    if (!data || !data.promos || typeof data.promos !== 'object') {
      throw new LauncherError(
        Codes.FORGE_UNSUPPORTED,
        'Forge promosyon listesi okunamadı.'
      );
    }
    promosCache = data.promos;
    promosCachedAt = now;
    return promosCache;
  }

  async function pickForgeVersion(mcVersion) {
    const promos = await loadPromos();
    const recommended = promos[`${mcVersion}-recommended`];
    const latest = promos[`${mcVersion}-latest`];
    const version = recommended || latest;
    if (!version) {
      throw new LauncherError(
        Codes.FORGE_UNSUPPORTED,
        `Forge bu Minecraft sürümü için yayınlanmamış: ${mcVersion}`
      );
    }
    return version;
  }

  function installersDir() {
    return path.join(paths.userDataDir, 'forge-installers');
  }

  async function ensureInstallerJar({ mcVersion, forgeVersionOverride, emit }) {
    const forgeVersion = forgeVersionOverride || (await pickForgeVersion(mcVersion));
    const dir = installersDir();
    await fs.promises.mkdir(dir, { recursive: true });
    // forgeVersion, uzak promos JSON'undan geliyor ve dosya adına gömülüyor;
    // "../" içeren bir sürüm installersDir dışına yazabilirdi.
    const installerName = `forge-${mcVersion}-${forgeVersion}-installer.jar`;
    const installerPath = assertInside(
      dir,
      installerName,
      `Forge sürümü güvenli değil: "${forgeVersion}".`
    );

    if (fs.existsSync(installerPath) && fs.statSync(installerPath).size > 0) {
      return { installerPath, forgeVersion };
    }

    if (emit && emit.status) {
      emit.status({ text: `Forge yükleyicisi indiriliyor (${forgeVersion})...` });
    }
    await httpClient.download(installerJarUrl(mcVersion, forgeVersion), installerPath);
    return { installerPath, forgeVersion };
  }

  function runJar({ javaPath, args, cwd }) {
    return new Promise((resolve, reject) => {
      const proc = spawn(javaPath || 'java', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stdout.on('data', () => {});
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
      proc.on('error', (err) => reject(err));
      proc.on('exit', (code) => {
        if (code === 0) return resolve();
        reject(
          new LauncherError(
            Codes.FORGE_UNSUPPORTED,
            `Forge installer çıkışı kod ${code}. Detay: ${stderr.slice(-400) || '(stderr boş)'}`
          )
        );
      });
    });
  }

  async function ensureInstalled({ mcVersion, forgeVersionOverride, gameRoot, javaPath, emit }) {
    const { installerPath, forgeVersion } = await ensureInstallerJar({
      mcVersion,
      forgeVersionOverride,
      emit,
    });

    const already = findInstalledProfile(gameRoot, mcVersion, forgeVersion);
    if (already) return { customId: already, forgeVersion };

    await fs.promises.mkdir(gameRoot, { recursive: true });
    // Forge installer `launcher_profiles.json` arıyor; yoksa minimum bir tane yaz.
    const profilesPath = path.join(gameRoot, 'launcher_profiles.json');
    if (!fs.existsSync(profilesPath)) {
      fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2), 'utf8');
    }

    if (emit && emit.status) {
      emit.status({ text: `Forge kuruluyor (${forgeVersion})... — Java installer çalışıyor` });
    }
    await runJar({
      javaPath,
      args: ['-jar', installerPath, '--installClient', gameRoot],
      cwd: gameRoot,
    });

    const installed = findInstalledProfile(gameRoot, mcVersion, forgeVersion);
    if (!installed) {
      throw new LauncherError(
        Codes.FORGE_UNSUPPORTED,
        `Forge installer tamamlandı fakat versions/ altında profil bulunamadı (${mcVersion}-${forgeVersion}).`
      );
    }
    return { customId: installed, forgeVersion };
  }

  return { pickForgeVersion, ensureInstallerJar, ensureInstalled };
}

module.exports = { createForgeInstaller };
