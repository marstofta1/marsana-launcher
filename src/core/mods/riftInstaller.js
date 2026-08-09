'use strict';

const fs = require('fs');
const path = require('path');

const { LauncherError, Codes } = require('../infra/errors');

const RIFT_MAVEN = 'https://www.dimdev.org/maven/';
const RIFT_MIRROR = 'https://raw.githubusercontent.com/Lazy-Bing-Server/RiftMultiMCMirror/master/';
const MOJANG_LIBS = 'https://libraries.minecraft.net/';
const MAVEN_CENTRAL = 'https://repo1.maven.org/maven2/';
const RIFT_RELEASE_BASE = 'https://github.com/DimensionalDevelopment/Rift/releases/download';
const RIFT_TWEAKER = 'org.dimdev.riftloader.launch.RiftLoaderClientTweaker';
const MIXIN_COORD = 'org.dimdev:mixin:0.7.11-SNAPSHOT';
const MIXIN_MIRROR = `${RIFT_MIRROR}org/dimdev/mixin/0.7.11-SNAPSHOT/mixin-0.7.11-SNAPSHOT.jar`;

// 1.13.2 için resmi GitHub Rift-1.0.4-106.jar retail client refmap ile uyuşmuyor;
// Chocohead build + vanilla parent profili (Ornithe ile aynı MCLC deseni) kullanılır.
const RIFT_GAME_CONFIG = Object.freeze({
  '1.13': {
    loaderVersion: '1.0.4-66',
    riftLibrary: { name: 'org.dimdev:rift:1.0.4-66', url: RIFT_MAVEN },
    riftDownloadUrls: [
      `${RIFT_RELEASE_BASE}/v1.0.4-66/Rift-1.0.4-66.jar`,
      `${RIFT_MAVEN}org/dimdev/rift/1.0.4-66/rift-1.0.4-66.jar`,
    ],
  },
  '1.13.2': {
    loaderVersion: '1.0.4-jitpack-c283efe7bd-1',
    riftLibrary: {
      name: 'com.github.Chocohead:Rift:jitpack-c283efe7bd-1',
      url: RIFT_MIRROR,
    },
    riftDownloadUrls: [
      `${RIFT_MIRROR}com/github/Chocohead/Rift/jitpack-c283efe7bd-1/Rift-jitpack-c283efe7bd-1.jar`,
    ],
  },
});

function libraryJarPath(gameRoot, name) {
  const [group, artifact, version] = name.split(':');
  return path.join(
    gameRoot,
    'libraries',
    ...group.split('.'),
    artifact,
    version,
    `${artifact}-${version}.jar`
  );
}

function isValidJar(filePath, minBytes = 1024) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size >= minBytes;
  } catch {
    return false;
  }
}

function mixinDownloadUrls() {
  return [MIXIN_MIRROR, `${RIFT_MAVEN}org/dimdev/mixin/0.7.11-SNAPSHOT/mixin-0.7.11-SNAPSHOT.jar`];
}

function buildLoaderLibraries(cfg) {
  return [
    { name: 'net.minecraft:launchwrapper:1.12', url: MOJANG_LIBS },
    { name: 'org.ow2.asm:asm:6.2', url: MAVEN_CENTRAL },
    { name: 'org.ow2.asm:asm-commons:6.2', url: MAVEN_CENTRAL },
    { name: 'org.ow2.asm:asm-tree:6.2', url: MAVEN_CENTRAL },
    { name: MIXIN_COORD, url: RIFT_MIRROR },
    cfg.riftLibrary,
  ];
}

function buildMclcLoaderJson(cfg, customId) {
  return {
    id: customId,
    type: 'release',
    mainClass: 'net.minecraft.launchwrapper.Launch',
    libraries: buildLoaderLibraries(cfg),
    arguments: {
      game: ['--tweakClass', RIFT_TWEAKER],
    },
  };
}

function createRiftInstaller({ httpClient, versionService }) {
  function getConfig(gameVersion) {
    const cfg = RIFT_GAME_CONFIG[gameVersion];
    if (!cfg) {
      throw new LauncherError(
        Codes.FABRIC_UNSUPPORTED,
        `Rift yalnızca Minecraft 1.13 ve 1.13.2 destekler: ${gameVersion}`
      );
    }
    return cfg;
  }

  async function downloadFirst(urls, dest) {
    let lastError;
    for (const url of urls) {
      try {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        await httpClient.download(url, dest);
        if (!isValidJar(dest)) {
          throw new Error('Indirilen Rift kütüphanesi geçersiz veya boş');
        }
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
    throw lastError || new LauncherError(Codes.HTTP, 'Rift kütüphaneleri indirilemedi');
  }

  async function ensureLibraries({ gameRoot, gameVersion, emit }) {
    const cfg = getConfig(gameVersion);
    const libraries = [
      { label: 'Rift', name: cfg.riftLibrary.name, urls: cfg.riftDownloadUrls },
      { label: 'Mixin', name: MIXIN_COORD, urls: mixinDownloadUrls() },
    ];

    for (const lib of libraries) {
      const dest = libraryJarPath(gameRoot, lib.name);
      if (isValidJar(dest)) continue;
      if (emit && emit.status) {
        emit.status({ text: `${lib.label} indiriliyor (${gameVersion})…` });
      }
      await downloadFirst(lib.urls, dest);
    }
  }

  function listSupportedGameVersions() {
    return Object.keys(RIFT_GAME_CONFIG);
  }

  async function prepareMclcLaunch({ gameVersion, gameRoot, emit, customIdPrefix = 'marsana-rift' }) {
    const cfg = getConfig(gameVersion);
    const parentJson = await versionService.getVersionJson(gameVersion);
    const customId = `${customIdPrefix}-${gameVersion}`;
    const versionDir = path.join(gameRoot, 'versions', customId);
    await fs.promises.mkdir(versionDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(versionDir, `${gameVersion}.json`),
      JSON.stringify(parentJson, null, 2),
      'utf8'
    );

    const loaderJson = buildMclcLoaderJson(cfg, customId);
    await fs.promises.writeFile(
      path.join(versionDir, `${customId}.json`),
      JSON.stringify(loaderJson, null, 2),
      'utf8'
    );

    const gameJarPath = path.join(versionDir, `${customId}.jar`);
    if (!isValidJar(gameJarPath, 100_000) && parentJson.downloads?.client?.url) {
      if (emit && emit.status) {
        emit.status({ text: `Minecraft client jar indiriliyor (${gameVersion})…` });
      }
      const client = parentJson.downloads.client;
      await httpClient.download(client.url, gameJarPath, { sha1: client.sha1, size: client.size });
    }

    const assetIndexId = (parentJson.assetIndex && parentJson.assetIndex.id) || gameVersion;
    return { loaderVersion: cfg.loaderVersion, customId, assetIndexId, assetIndex: parentJson.assetIndex };
  }

  return { listSupportedGameVersions, ensureLibraries, prepareMclcLaunch };
}

module.exports = { createRiftInstaller };
