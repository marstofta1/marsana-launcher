'use strict';

const fs = require('fs');
const path = require('path');
const { createMetaLoaderInstaller } = require('./metaLoaderInstaller');

const ORNITHE_META = 'https://meta.ornithemc.net/v2/versions';
const { ORNITHE_BLOCKED_SET } = require('../../shared/ornitheCompatibility');

function buildMclcLoaderJson(rawProfile, customId) {
  const child = {
    id: customId,
    type: 'release',
    mainClass: rawProfile.mainClass,
    libraries: rawProfile.libraries,
  };
  const jvmArgs = rawProfile.arguments?.jvm;
  if (Array.isArray(jvmArgs) && jvmArgs.length > 0) {
    child.arguments = { jvm: jvmArgs };
  }
  return child;
}

function createOrnitheInstaller({ httpClient, versionService }) {
  const base = createMetaLoaderInstaller({
    httpClient,
    versionService,
    baseUrl: ORNITHE_META,
    unsupportedMessage: 'Ornithe bu Minecraft sürümünü desteklemiyor',
    supportedGameUrl: `${ORNITHE_META}/game`,
    legacyMerge: false,
  });

  let supportedCache = null;
  let supportedAt = 0;
  const SUPPORTED_TTL_MS = 60 * 60 * 1000;

  async function listSupportedGameVersions() {
    const now = Date.now();
    if (supportedCache && now - supportedAt < SUPPORTED_TTL_MS) return supportedCache;
    const raw = await httpClient.fetchJson(`${ORNITHE_META}/game`);
    supportedCache = Array.isArray(raw)
      ? raw
          .filter((e) => e && e.stable && e.version)
          .map((e) => String(e.version))
          .filter((v) => !ORNITHE_BLOCKED_SET.has(v))
      : [];
    supportedAt = now;
    return supportedCache;
  }

  // MCLC inheritsFrom desteklemez; vanilla parent + yalnızca loader katmanı birleştirilir.
  async function prepareMclcLaunch({ gameVersion, gameRoot, emit, customIdPrefix = 'marsana-ornithe' }) {
    const { profile: loaderProfile, loaderVersion } = await base.fetchProfileJson(gameVersion);
    const parentJson = await versionService.getVersionJson(gameVersion);
    const customId = `${customIdPrefix}-${gameVersion}`;
    const versionDir = path.join(gameRoot, 'versions', customId);
    await fs.promises.mkdir(versionDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(versionDir, `${gameVersion}.json`),
      JSON.stringify(parentJson, null, 2),
      'utf8'
    );

    const loaderJson = buildMclcLoaderJson(loaderProfile, customId);
    const customJsonPath = path.join(versionDir, `${customId}.json`);
    await fs.promises.writeFile(customJsonPath, JSON.stringify(loaderJson, null, 2), 'utf8');

    const gameJarPath = path.join(versionDir, `${customId}.jar`);
    if (!fs.existsSync(gameJarPath) && parentJson.downloads?.client?.url) {
      if (emit && emit.status) {
        emit.status({ text: `Minecraft client jar indiriliyor (${gameVersion})…` });
      }
      const client = parentJson.downloads.client;
      await httpClient.download(client.url, gameJarPath, { sha1: client.sha1, size: client.size });
    }

    const assetIndexId = (parentJson.assetIndex && parentJson.assetIndex.id) || gameVersion;
    return { loaderVersion, customId, customJsonPath, assetIndexId, assetIndex: parentJson.assetIndex };
  }

  return {
    ...base,
    listSupportedGameVersions,
    prepareMclcLaunch,
  };
}

module.exports = { createOrnitheInstaller };
