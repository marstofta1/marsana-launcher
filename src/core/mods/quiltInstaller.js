'use strict';

const { LauncherError, Codes } = require('../infra/errors');

const QUILT_META = 'https://meta.quiltmc.org/v3/versions/loader';

function loaderListUrl(gameVersion) {
  return `${QUILT_META}/${encodeURIComponent(gameVersion)}`;
}

function profileJsonUrl(gameVersion, loaderVersion) {
  return `${QUILT_META}/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
}

function mergeLibraries(parentLibs = [], quiltLibs = []) {
  const map = new Map();
  for (const lib of parentLibs) if (lib && lib.name) map.set(lib.name, lib);
  for (const lib of quiltLibs) if (lib && lib.name) map.set(lib.name, lib);
  return [...map.values()];
}

function mergeArguments(parent, quiltProfile) {
  if (parent.minecraftArguments && !parent.arguments) {
    throw new LauncherError(
      Codes.UNSUPPORTED_VERSION,
      'Bu Minecraft sürümü çok eski; Quilt için 1.18 veya üstü bir sürüm seçin.'
    );
  }
  const pa = parent.arguments || { game: [], jvm: [] };
  const qa = quiltProfile.arguments || { game: [], jvm: [] };
  return {
    game: [...(pa.game || [])],
    jvm: [...(qa.jvm || []), ...(pa.jvm || [])],
  };
}

function mergeProfileWithParent(quiltProfile, parentJson, gameVersion) {
  const merged = { ...parentJson };
  merged.libraries = mergeLibraries(parentJson.libraries, quiltProfile.libraries);
  merged.mainClass = quiltProfile.mainClass;
  merged.arguments = mergeArguments(parentJson, quiltProfile);
  merged.id = gameVersion;
  delete merged.inheritsFrom;
  merged.downloads = parentJson.downloads;
  merged.assetIndex = parentJson.assetIndex;
  merged.assets = parentJson.assets;
  return merged;
}

function createQuiltInstaller({ httpClient, versionService }) {
  // Quilt'in henüz "stable" işareti yok; meta zaten en yeni → eski sıralı,
  // ilk eleman en son sürümdür. Beta sürümleri Quilt için normal akıştır.
  async function pickLatestLoader(gameVersion) {
    const list = await httpClient.fetchJson(loaderListUrl(gameVersion));
    if (!Array.isArray(list) || list.length === 0) {
      throw new LauncherError(
        Codes.FABRIC_UNSUPPORTED,
        `Quilt bu Minecraft sürümünü desteklemiyor: ${gameVersion}`
      );
    }
    return list[0].loader.version;
  }

  async function buildMergedProfile(gameVersion) {
    const loaderVersion = await pickLatestLoader(gameVersion);
    const [quiltProfile, parentJson] = await Promise.all([
      httpClient.fetchJson(profileJsonUrl(gameVersion, loaderVersion)),
      versionService.getVersionJson(gameVersion),
    ]);
    const merged = mergeProfileWithParent(quiltProfile, parentJson, gameVersion);
    return { merged, loaderVersion };
  }

  return { pickLatestLoader, buildMergedProfile };
}

module.exports = { createQuiltInstaller };
