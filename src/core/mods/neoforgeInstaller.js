'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { LauncherError, Codes } = require('../infra/errors');
const { assertInside } = require('../infra/safeZip');

// Modern NeoForge (1.20.2+) ve legacy 1.20.1 farklı maven path'lerinde
// barınıyor. 1.20.1 NeoForged ekibi tarafından eski Forge fork'unun "forge"
// paket adı altında devam ettirildi; modern sürümler "neoforge" adıyla.
const META_URL_MODERN =
  'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';
const META_URL_LEGACY_1_20_1 =
  'https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml';

function isLegacy1201(mcVersion) {
  return String(mcVersion) === '1.20.1';
}

function installerJarUrl(neoforgeVersion, legacy) {
  if (legacy) {
    return (
      'https://maven.neoforged.net/releases/net/neoforged/forge/' +
      `${neoforgeVersion}/forge-${neoforgeVersion}-installer.jar`
    );
  }
  return (
    'https://maven.neoforged.net/releases/net/neoforged/neoforge/' +
    `${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`
  );
}

// NeoForge sürüm formatı (modern): <MC-prefix>.<patch>[-beta]
//  - Minecraft 1.X.Y  → prefix "X.Y"   (örn. 1.21.4 → 21.4)
//  - Minecraft N.X.Y  → prefix "N.X.Y" (örn. 26.1.2 → 26.1.2)
//
// Legacy 1.20.1 için sürüm "1.20.1-<patch>" (örn. "1.20.1-47.1.106"). Bu eski
// Forge'un naming şemasını taşır ama NeoForged'in maven'ında.
function neoforgePrefixFor(mcVersion) {
  if (isLegacy1201(mcVersion)) return '1.20.1';
  const v = String(mcVersion);
  const legacy = v.match(/^1\.(\d+(?:\.\d+)?)$/);
  if (legacy) return legacy[1];
  return v;
}

function isStable(versionStr) {
  return !/-(beta|rc|alpha|pre)/i.test(versionStr);
}

function candidateProfileIds(neoforgeVersion, legacy) {
  if (legacy) {
    // Legacy 1.20.1 installer Forge'un eski naming'ini kullanır:
    // örn. profile id = `1.20.1-forge-47.1.106`
    return [
      `${neoforgeVersion.replace(/^1\.20\.1-/, '1.20.1-forge-')}`,
      `neoforge-${neoforgeVersion}`,
      `${neoforgeVersion}`,
    ];
  }
  return [
    `neoforge-${neoforgeVersion}`,
    `NeoForge-${neoforgeVersion}`,
  ];
}

function findInstalledProfile(gameRoot, neoforgeVersion, legacy) {
  const versionsDir = path.join(gameRoot, 'versions');
  if (!fs.existsSync(versionsDir)) return null;
  for (const id of candidateProfileIds(neoforgeVersion, legacy)) {
    if (fs.existsSync(path.join(versionsDir, id, `${id}.json`))) return id;
  }
  // Fallback: forge/neoforge ve sürüm string'inden bir parça içeren herhangi
  // bir profil — 1.20.1-47.1.106 → "47.1.106" yi içeren her profil eşleşir.
  const numericPart = neoforgeVersion.replace(/^1\.20\.1-/, '');
  for (const entry of fs.readdirSync(versionsDir)) {
    const lower = entry.toLowerCase();
    const matchesLoader =
      lower.includes('neoforge') || (legacy && lower.includes('forge'));
    if (
      matchesLoader &&
      (lower.includes(neoforgeVersion.toLowerCase()) || lower.includes(numericPart.toLowerCase())) &&
      fs.existsSync(path.join(versionsDir, entry, `${entry}.json`))
    ) {
      return entry;
    }
  }
  return null;
}

function createNeoForgeInstaller({ httpClient, paths }) {
  const cache = { modern: null, legacy: null };
  const cacheAt = { modern: 0, legacy: 0 };
  const META_TTL_MS = 60 * 60 * 1000;

  async function loadVersions(legacy) {
    const key = legacy ? 'legacy' : 'modern';
    const now = Date.now();
    if (cache[key] && now - cacheAt[key] < META_TTL_MS) return cache[key];
    const url = legacy ? META_URL_LEGACY_1_20_1 : META_URL_MODERN;
    const xml = await httpClient.fetchText(url);
    const versions = [];
    const re = /<version>([^<]+)<\/version>/g;
    let m;
    while ((m = re.exec(xml)) !== null) versions.push(m[1]);
    if (versions.length === 0) {
      throw new LauncherError(
        Codes.FORGE_UNSUPPORTED,
        `NeoForge maven-metadata.xml okunamadı (${key}).`
      );
    }
    cache[key] = versions;
    cacheAt[key] = now;
    return versions;
  }

  async function pickNeoForgeVersion(mcVersion) {
    const legacy = isLegacy1201(mcVersion);
    const prefix = neoforgePrefixFor(mcVersion);
    const all = await loadVersions(legacy);
    const matching = legacy
      ? all.filter((v) => v.startsWith(`${prefix}-`))
      : all.filter((v) => v === prefix || v.startsWith(`${prefix}.`));
    if (matching.length === 0) {
      throw new LauncherError(
        Codes.FORGE_UNSUPPORTED,
        `NeoForge bu Minecraft sürümü için yayınlanmamış: ${mcVersion}`
      );
    }
    const stable = matching.filter(isStable);
    const pool = stable.length > 0 ? stable : matching;
    // Maven metadata zaten kronolojik; sondaki en yenidir.
    return pool[pool.length - 1];
  }

  function installersDir() {
    return path.join(paths.userDataDir, 'neoforge-installers');
  }

  async function ensureInstallerJar({ mcVersion, emit }) {
    const legacy = isLegacy1201(mcVersion);
    const neoforgeVersion = await pickNeoForgeVersion(mcVersion);
    const dir = installersDir();
    await fs.promises.mkdir(dir, { recursive: true });
    // neoforgeVersion, uzak maven-metadata.xml'den geliyor ve dosya adına
    // gömülüyor; "../" içeren bir sürüm installersDir dışına yazabilirdi.
    const installerName = legacy
      ? `forge-${neoforgeVersion}-installer.jar`
      : `neoforge-${neoforgeVersion}-installer.jar`;
    const installerPath = assertInside(
      dir,
      installerName,
      `NeoForge sürümü güvenli değil: "${neoforgeVersion}".`
    );

    if (fs.existsSync(installerPath) && fs.statSync(installerPath).size > 0) {
      return { installerPath, neoforgeVersion, legacy };
    }
    if (emit && emit.status) {
      emit.status({ text: `NeoForge yükleyicisi indiriliyor (${neoforgeVersion})...` });
    }
    await httpClient.download(installerJarUrl(neoforgeVersion, legacy), installerPath);
    return { installerPath, neoforgeVersion, legacy };
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
            `NeoForge installer çıkışı kod ${code}. Detay: ${stderr.slice(-400) || '(stderr boş)'}`
          )
        );
      });
    });
  }

  async function ensureInstalled({ mcVersion, gameRoot, javaPath, emit }) {
    const { installerPath, neoforgeVersion, legacy } = await ensureInstallerJar({
      mcVersion,
      emit,
    });

    const already = findInstalledProfile(gameRoot, neoforgeVersion, legacy);
    if (already) return { customId: already, neoforgeVersion };

    await fs.promises.mkdir(gameRoot, { recursive: true });
    const profilesPath = path.join(gameRoot, 'launcher_profiles.json');
    if (!fs.existsSync(profilesPath)) {
      fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2), 'utf8');
    }

    if (emit && emit.status) {
      emit.status({ text: `NeoForge kuruluyor (${neoforgeVersion})... — Java installer çalışıyor` });
    }
    // Modern NeoForge installer: `--install-client <dir>`.
    // Legacy (1.20.1) Forge installer: `--installClient <dir>` (camelCase, eski stil).
    const cliFlag = legacy ? '--installClient' : '--install-client';
    await runJar({
      javaPath,
      args: ['-jar', installerPath, cliFlag, gameRoot],
      cwd: gameRoot,
    });

    const installed = findInstalledProfile(gameRoot, neoforgeVersion, legacy);
    if (!installed) {
      throw new LauncherError(
        Codes.FORGE_UNSUPPORTED,
        `NeoForge installer tamamlandı fakat versions/ altında profil bulunamadı (${neoforgeVersion}).`
      );
    }
    return { customId: installed, neoforgeVersion };
  }

  return { pickNeoForgeVersion, ensureInstallerJar, ensureInstalled };
}

module.exports = { createNeoForgeInstaller };
