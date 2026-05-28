'use strict';

const { LauncherError, Codes } = require('../infra/errors');
const { mergeProfileWithParent } = require('./metaLoaderInstaller');

const LITELOADER_VERSIONS_URL = 'http://dl.liteloader.com/versions/versions.json';
const LITELOADER_REPO = 'http://dl.liteloader.com/versions/';

function pickLatestArtefact(mcEntry) {
  const bucket = mcEntry.artefacts || mcEntry.snapshots;
  if (!bucket) return null;
  const ll = bucket['com.mumfrey:liteloader'];
  if (!ll) return null;
  if (ll.latest) return ll.latest;
  const keys = Object.keys(ll).filter((k) => k !== 'latest');
  if (keys.length === 0) return null;
  return ll[keys[0]];
}

function buildLiteLoaderLibraries(artefact, mcVersion) {
  const libs = (artefact.libraries || []).map((lib) => ({ ...lib }));
  const version = artefact.version || `${mcVersion}_01`;
  libs.push({
    name: `com.mumfrey:liteloader:${version}`,
    url: LITELOADER_REPO,
  });
  return libs;
}

function applyTweakClass(parentJson, tweakClass) {
  const merged = { ...parentJson };
  if (merged.arguments && merged.arguments.game) {
    merged.arguments = {
      ...merged.arguments,
      game: ['--tweakClass', tweakClass, ...(merged.arguments.game || [])],
    };
    return merged;
  }
  const base = merged.minecraftArguments || '';
  merged.minecraftArguments = `${base} --tweakClass ${tweakClass}`.trim();
  return merged;
}

function createLiteLoaderInstaller({ httpClient, versionService }) {
  let versionsDoc = null;
  let versionsAt = 0;
  const VERSIONS_TTL_MS = 60 * 60 * 1000;

  async function loadVersionsDoc() {
    const now = Date.now();
    if (versionsDoc && now - versionsAt < VERSIONS_TTL_MS) return versionsDoc;
    versionsDoc = await httpClient.fetchJson(LITELOADER_VERSIONS_URL);
    versionsAt = now;
    return versionsDoc;
  }

  async function listSupportedGameVersions() {
    const doc = await loadVersionsDoc();
    const versions = doc && doc.versions ? doc.versions : {};
    return Object.keys(versions).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }

  async function buildMergedProfile(gameVersion) {
    const doc = await loadVersionsDoc();
    const mcEntry = doc && doc.versions ? doc.versions[gameVersion] : null;
    const artefact = mcEntry ? pickLatestArtefact(mcEntry) : null;
    if (!artefact || !artefact.tweakClass) {
      throw new LauncherError(
        Codes.FABRIC_UNSUPPORTED,
        `LiteLoader bu Minecraft sürümünü desteklemiyor: ${gameVersion}`
      );
    }

    const loaderProfile = {
      mainClass: 'net.minecraft.launchwrapper.Launch',
      libraries: buildLiteLoaderLibraries(artefact, gameVersion),
      arguments: { game: [], jvm: [] },
    };

    const parentJson = await versionService.getVersionJson(gameVersion);
    let merged = mergeProfileWithParent(loaderProfile, parentJson, gameVersion, { legacy: true });
    merged = applyTweakClass(merged, artefact.tweakClass);
    return { merged, loaderVersion: artefact.version || gameVersion };
  }

  return { buildMergedProfile, listSupportedGameVersions };
}

module.exports = { createLiteLoaderInstaller };
