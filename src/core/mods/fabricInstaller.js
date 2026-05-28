'use strict';

const { LauncherError, Codes } = require('../infra/errors');

const FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader';

function loaderListUrl(gameVersion) {
  return `${FABRIC_META}/${encodeURIComponent(gameVersion)}`;
}

function profileJsonUrl(gameVersion, loaderVersion) {
  return `${FABRIC_META}/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
}

function mergeLibraries(parentLibs = [], fabricLibs = []) {
  const map = new Map();
  for (const lib of parentLibs) if (lib && lib.name) map.set(lib.name, lib);
  for (const lib of fabricLibs) if (lib && lib.name) map.set(lib.name, lib);
  return [...map.values()];
}

function mergeArguments(parent, fabricProfile) {
  if (parent.minecraftArguments && !parent.arguments) {
    throw new LauncherError(
      Codes.UNSUPPORTED_VERSION,
      'Bu Minecraft sürümü çok eski; shader yığını için 1.18 veya üstü bir sürüm seçin.'
    );
  }
  const pa = parent.arguments || { game: [], jvm: [] };
  const fa = fabricProfile.arguments || { game: [], jvm: [] };
  return {
    game: [...(pa.game || [])],
    jvm: [...(fa.jvm || []), ...(pa.jvm || [])],
  };
}

function mergeProfileWithParent(fabricProfile, parentJson, gameVersion) {
  const merged = { ...parentJson };
  merged.libraries = mergeLibraries(parentJson.libraries, fabricProfile.libraries);
  merged.mainClass = fabricProfile.mainClass;
  merged.arguments = mergeArguments(parentJson, fabricProfile);
  merged.id = gameVersion;
  delete merged.inheritsFrom;
  merged.downloads = parentJson.downloads;
  merged.assetIndex = parentJson.assetIndex;
  merged.assets = parentJson.assets;
  return merged;
}

function createFabricInstaller({ httpClient, versionService }) {
  async function pickStableLoader(gameVersion) {
    const list = await httpClient.fetchJson(loaderListUrl(gameVersion));
    if (!Array.isArray(list) || list.length === 0) {
      throw new LauncherError(
        Codes.FABRIC_UNSUPPORTED,
        `Fabric bu Minecraft sürümünü desteklemiyor: ${gameVersion}`
      );
    }
    const stable = list.find((e) => e.loader && e.loader.stable);
    return (stable || list[0]).loader.version;
  }

  async function pickBetaLoader(gameVersion) {
    try {
      const list = await httpClient.fetchJson(loaderListUrl(gameVersion));
      if (Array.isArray(list) && list.length > 0) {
        const beta = list.find((e) => e.loader && e.loader.stable === false);
        if (beta) return beta.loader.version;
      }
    } catch {
      /* fall through */
    }
    const global = await httpClient.fetchJson(FABRIC_META);
    if (Array.isArray(global)) {
      const beta = global.find((e) => e.stable === false);
      if (beta) return beta.version;
    }
    return pickStableLoader(gameVersion);
  }

  async function buildMergedProfile(gameVersion, { channel = 'stable' } = {}) {
    const loaderVersion =
      channel === 'beta' ? await pickBetaLoader(gameVersion) : await pickStableLoader(gameVersion);
    const [fabricProfile, parentJson] = await Promise.all([
      httpClient.fetchJson(profileJsonUrl(gameVersion, loaderVersion)),
      versionService.getVersionJson(gameVersion),
    ]);
    const merged = mergeProfileWithParent(fabricProfile, parentJson, gameVersion);
    return { merged, loaderVersion };
  }

  return { pickStableLoader, pickBetaLoader, buildMergedProfile };
}

module.exports = { createFabricInstaller };
