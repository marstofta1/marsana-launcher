'use strict';

const { LauncherError, Codes } = require('../infra/errors');

function mergeLibraries(parentLibs = [], loaderLibs = []) {
  const map = new Map();
  for (const lib of parentLibs) if (lib && lib.name) map.set(lib.name, lib);
  for (const lib of loaderLibs) if (lib && lib.name) map.set(lib.name, lib);
  return [...map.values()];
}

function mergeArgumentsModern(parent, loaderProfile) {
  if (parent.minecraftArguments && !parent.arguments) {
    throw new LauncherError(
      Codes.UNSUPPORTED_VERSION,
      'Bu Minecraft sürümü çok eski; modern bir loader profili birleştirilemedi.'
    );
  }
  const pa = parent.arguments || { game: [], jvm: [] };
  const la = loaderProfile.arguments || { game: [], jvm: [] };
  return {
    game: [...(pa.game || []), ...(la.game || [])],
    jvm: [...(la.jvm || []), ...(pa.jvm || [])],
  };
}

function mergeArgumentsLegacy(parent, loaderProfile) {
  const la = loaderProfile.arguments || { game: [], jvm: [] };
  if (parent.arguments) {
    const pa = parent.arguments;
    return {
      game: [...(pa.game || []), ...(la.game || [])],
      jvm: [...(la.jvm || []), ...(pa.jvm || [])],
    };
  }
  return {
    minecraftArguments: parent.minecraftArguments,
    jvm: [...(la.jvm || [])],
  };
}

function mergeProfileWithParent(loaderProfile, parentJson, gameVersion, { legacy = false } = {}) {
  const merged = { ...parentJson };
  merged.libraries = mergeLibraries(parentJson.libraries, loaderProfile.libraries);
  merged.mainClass = loaderProfile.mainClass || parentJson.mainClass;
  const mergedArgs = legacy
    ? mergeArgumentsLegacy(parentJson, loaderProfile)
    : mergeArgumentsModern(parentJson, loaderProfile);
  if (mergedArgs.minecraftArguments) {
    merged.minecraftArguments = mergedArgs.minecraftArguments;
    merged.arguments = { jvm: mergedArgs.jvm, game: mergedArgs.game || [] };
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

function createMetaLoaderInstaller({
  httpClient,
  versionService,
  baseUrl,
  unsupportedMessage = 'Loader bu Minecraft sürümünü desteklemiyor',
  supportedGameUrl = null,
  legacyMerge = false,
}) {
  const root = String(baseUrl).replace(/\/$/, '');

  function loaderListUrl(gameVersion) {
    return `${root}/loader/${encodeURIComponent(gameVersion)}`;
  }

  function profileJsonUrl(gameVersion, loaderVersion) {
    return `${root}/loader/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  }

  async function pickStableLoader(gameVersion) {
    const list = await httpClient.fetchJson(loaderListUrl(gameVersion));
    if (!Array.isArray(list) || list.length === 0) {
      throw new LauncherError(Codes.FABRIC_UNSUPPORTED, `${unsupportedMessage}: ${gameVersion}`);
    }
    const stable = list.find((e) => e.loader && e.loader.stable);
    const entry = stable || list[0];
    return entry.loader.version;
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
    return pickStableLoader(gameVersion);
  }

  async function fetchProfileJson(gameVersion, { channel = 'stable' } = {}) {
    const loaderVersion =
      channel === 'beta' ? await pickBetaLoader(gameVersion) : await pickStableLoader(gameVersion);
    const profile = await httpClient.fetchJson(profileJsonUrl(gameVersion, loaderVersion));
    return { profile, loaderVersion };
  }

  async function buildMergedProfile(gameVersion, { channel = 'stable' } = {}) {
    const { profile: loaderProfile, loaderVersion } = await fetchProfileJson(gameVersion, { channel });
    const parentJson = await versionService.getVersionJson(gameVersion);
    const merged = mergeProfileWithParent(loaderProfile, parentJson, gameVersion, {
      legacy: legacyMerge,
    });
    return { merged, loaderVersion };
  }

  async function buildInheritedProfile(gameVersion, { channel = 'stable', customIdPrefix }) {
    const { profile, loaderVersion } = await fetchProfileJson(gameVersion, { channel });
    const customId = `${customIdPrefix}-${gameVersion}`;
    profile.id = customId;
    return { profile, loaderVersion, customId };
  }

  let supportedCache = null;
  let supportedAt = 0;
  const SUPPORTED_TTL_MS = 60 * 60 * 1000;

  async function listSupportedGameVersions() {
    if (!supportedGameUrl) return [];
    const now = Date.now();
    if (supportedCache && now - supportedAt < SUPPORTED_TTL_MS) return supportedCache;
    const list = await httpClient.fetchJson(supportedGameUrl);
    supportedCache = Array.isArray(list)
      ? list.map((e) => (e && e.version) || '').filter(Boolean)
      : [];
    supportedAt = now;
    return supportedCache;
  }

  return {
    pickStableLoader,
    pickBetaLoader,
    fetchProfileJson,
    buildMergedProfile,
    buildInheritedProfile,
    listSupportedGameVersions,
  };
}

module.exports = { createMetaLoaderInstaller, mergeProfileWithParent };
