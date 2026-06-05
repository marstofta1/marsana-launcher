'use strict';

const { LauncherError, Codes } = require('../infra/errors');
const { mergeLibraries } = require('./libraryMerge');

const LEGACY_FABRIC_META = 'https://meta.legacyfabric.net/v2/versions';

function loaderListUrl(gameVersion) {
  return `${LEGACY_FABRIC_META}/loader/${encodeURIComponent(gameVersion)}`;
}

function profileJsonUrl(gameVersion, loaderVersion) {
  return `${LEGACY_FABRIC_META}/loader/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
}

const SUPPORTED_GAME_URL = `${LEGACY_FABRIC_META}/game`;

// Legacy Fabric desteklenen sürümler (1.3 – 1.13) eski "minecraftArguments"
// (string) formatında manifest döndürür. Profile JSON yeni "arguments"
// (object) formatında geliyor — ikisini birleştir.
function mergeArgumentsLegacy(parent, fabricProfile) {
  const fa = fabricProfile.arguments || { game: [], jvm: [] };
  if (parent.arguments) {
    const pa = parent.arguments;
    return {
      game: [...(pa.game || [])],
      jvm: [...(fa.jvm || []), ...(pa.jvm || [])],
    };
  }
  return {
    minecraftArguments: parent.minecraftArguments,
    jvm: [...(fa.jvm || [])],
  };
}

function mergeProfileWithParent(fabricProfile, parentJson, gameVersion) {
  const merged = { ...parentJson };
  merged.libraries = mergeLibraries(parentJson.libraries, fabricProfile.libraries);
  merged.mainClass = fabricProfile.mainClass;
  const mergedArgs = mergeArgumentsLegacy(parentJson, fabricProfile);
  if (mergedArgs.minecraftArguments) {
    merged.minecraftArguments = mergedArgs.minecraftArguments;
    merged.arguments = { jvm: mergedArgs.jvm };
  } else {
    merged.arguments = mergedArgs;
    delete merged.minecraftArguments;
  }
  merged.id = gameVersion;
  delete merged.inheritsFrom;
  merged.downloads = parentJson.downloads;
  merged.assetIndex = parentJson.assetIndex;
  merged.assets = parentJson.assets;
  return merged;
}

function createLegacyFabricInstaller({ httpClient, versionService }) {
  let supportedCache = null;
  let supportedAt = 0;
  const SUPPORTED_TTL_MS = 60 * 60 * 1000;

  async function listSupportedGameVersions() {
    const now = Date.now();
    if (supportedCache && now - supportedAt < SUPPORTED_TTL_MS) return supportedCache;
    const list = await httpClient.fetchJson(SUPPORTED_GAME_URL);
    supportedCache = Array.isArray(list)
      ? list.map((e) => (e && e.version) || '').filter(Boolean)
      : [];
    supportedAt = now;
    return supportedCache;
  }

  async function pickStableLoader(gameVersion) {
    const list = await httpClient.fetchJson(loaderListUrl(gameVersion));
    if (!Array.isArray(list) || list.length === 0) {
      throw new LauncherError(
        Codes.FABRIC_UNSUPPORTED,
        `Legacy Fabric bu Minecraft sürümünü desteklemiyor: ${gameVersion}`
      );
    }
    const stable = list.find((e) => e.loader && e.loader.stable);
    return (stable || list[0]).loader.version;
  }

  async function buildMergedProfile(gameVersion) {
    const loaderVersion = await pickStableLoader(gameVersion);
    const [fabricProfile, parentJson] = await Promise.all([
      httpClient.fetchJson(profileJsonUrl(gameVersion, loaderVersion)),
      versionService.getVersionJson(gameVersion),
    ]);
    const merged = mergeProfileWithParent(fabricProfile, parentJson, gameVersion);
    return { merged, loaderVersion };
  }

  return { pickStableLoader, buildMergedProfile, listSupportedGameVersions };
}

module.exports = { createLegacyFabricInstaller };
