'use strict';

const { LauncherError, Codes } = require('../infra/errors');
const { mergeProfileWithParent } = require('./metaLoaderInstaller');

const RIFT_MAVEN = 'https://www.dimdev.org/maven/';
const RIFT_VERSIONS = Object.freeze({
  '1.13': '1.0.4-66',
  '1.13.2': '1.0.4-87',
});

function createRiftInstaller({ versionService }) {
  function listSupportedGameVersions() {
    return Object.keys(RIFT_VERSIONS);
  }

  async function buildMergedProfile(gameVersion) {
    const riftVersion = RIFT_VERSIONS[gameVersion];
    if (!riftVersion) {
      throw new LauncherError(
        Codes.FABRIC_UNSUPPORTED,
        `Rift yalnızca Minecraft 1.13 ve 1.13.2 destekler: ${gameVersion}`
      );
    }

    const loaderProfile = {
      mainClass: 'net.minecraft.launchwrapper.Launch',
      libraries: [
        { name: 'net.minecraft:launchwrapper:1.12' },
        { name: 'org.ow2.asm:asm:6.2', url: 'https://repo1.maven.org/maven2/' },
        { name: 'org.ow2.asm:asm-commons:6.2', url: 'https://repo1.maven.org/maven2/' },
        { name: 'org.ow2.asm:asm-tree:6.2', url: 'https://repo1.maven.org/maven2/' },
        { name: 'org.dimdev:mixin:0.7.11-SNAPSHOT', url: RIFT_MAVEN },
        { name: `org.dimdev:rift:${riftVersion}`, url: RIFT_MAVEN },
      ],
      arguments: { game: [], jvm: [] },
    };

    const parentJson = await versionService.getVersionJson(gameVersion);
    let merged = mergeProfileWithParent(loaderProfile, parentJson, gameVersion, { legacy: false });
    const tweak = 'org.dimdev.riftloader.launch.RiftLoaderClientTweaker';
    if (merged.arguments && merged.arguments.game) {
      merged.arguments = {
        ...merged.arguments,
        game: ['--tweakClass', tweak, ...(merged.arguments.game || [])],
      };
    } else {
      const base = merged.minecraftArguments || '';
      merged.minecraftArguments = `${base} --tweakClass ${tweak}`.trim();
    }
    return { merged, loaderVersion: riftVersion };
  }

  return { buildMergedProfile, listSupportedGameVersions };
}

module.exports = { createRiftInstaller };
