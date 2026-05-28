'use strict';

const { createPaths } = require('./paths');
const { createLogger } = require('../core/infra/logger');
const { createHttpClient } = require('../core/infra/httpClient');
const { createJsonFileStore } = require('../core/infra/fileStore');

const { createAccountStore } = require('../core/auth/accountStore');
const { createMicrosoftAuthProvider } = require('../core/auth/microsoftAuthProvider');
const { createAuthService } = require('../core/auth/authService');

const { createVersionService } = require('../core/minecraft/versionService');
const { createJavaRuntimeService } = require('../core/minecraft/javaRuntimeService');
const { createLaunchService } = require('../core/minecraft/launchService');
const { createBedrockLaunchService } = require('../core/minecraft/bedrockLaunchService');

const { createModrinthClient } = require('../core/mods/modrinthClient');
const { createFabricInstaller } = require('../core/mods/fabricInstaller');
const { createLegacyFabricInstaller } = require('../core/mods/legacyFabricInstaller');
const { createOrnitheInstaller } = require('../core/mods/ornitheInstaller');
const { createLiteLoaderInstaller } = require('../core/mods/liteloaderInstaller');
const { createRiftInstaller } = require('../core/mods/riftInstaller');
const { createNilLoaderInstaller } = require('../core/mods/nilloaderInstaller');
const { createQuiltInstaller } = require('../core/mods/quiltInstaller');
const { createForgeInstaller } = require('../core/mods/forgeInstaller');
const { createNeoForgeInstaller } = require('../core/mods/neoforgeInstaller');
const { createMrpackInstaller } = require('../core/mods/mrpackInstaller');
const { createOptifineDownloader } = require('../core/mods/optifineDownloader');
const { createShaderStackService } = require('../core/mods/shaderStackService');

const { createRecommendedServersService } = require('../core/servers/recommendedServers');

function buildContainer({ userDataDir }) {
  const paths = createPaths({ userDataDir });
  paths.ensureBaseDirs();

  const logger = createLogger({ level: 'info', namespace: 'marsana' });
  const httpClient = createHttpClient();

  const accountFileStore = createJsonFileStore({ filePath: paths.authFile });
  const accountStore = createAccountStore({ fileStore: accountFileStore });
  const authProvider = createMicrosoftAuthProvider();
  const authService = createAuthService({
    store: accountStore,
    authProvider,
    logger: logger.child('auth'),
  });

  const versionService = createVersionService({ httpClient });
  const javaRuntimeService = createJavaRuntimeService({
    httpClient,
    paths,
    logger: logger.child('java-runtime'),
  });
  const modrinthClient = createModrinthClient({ httpClient });
  const mrpackInstaller = createMrpackInstaller({ httpClient, modrinthClient });
  const fabricInstaller = createFabricInstaller({ httpClient, versionService });
  const legacyFabricInstaller = createLegacyFabricInstaller({ httpClient, versionService });
  const ornitheInstaller = createOrnitheInstaller({ httpClient, versionService });
  const liteloaderInstaller = createLiteLoaderInstaller({ httpClient, versionService });
  const riftInstaller = createRiftInstaller({ httpClient, versionService });
  const nilloaderInstaller = createNilLoaderInstaller({ httpClient, paths });
  const quiltInstaller = createQuiltInstaller({ httpClient, versionService });
  const forgeInstaller = createForgeInstaller({ httpClient, paths });
  const neoforgeInstaller = createNeoForgeInstaller({ httpClient, paths });
  const optifineDownloader = createOptifineDownloader({ httpClient, paths });
  const shaderStackService = createShaderStackService({
    httpClient,
    fabricInstaller,
    modrinthClient,
    mrpackInstaller,
  });

  const bedrockLaunchService = createBedrockLaunchService({ logger: logger.child('bedrock') });

  const launchService = createLaunchService({
    paths,
    httpClient,
    authService,
    shaderStackService,
    bedrockLaunchService,
    fabricInstaller,
    forgeInstaller,
    neoforgeInstaller,
    quiltInstaller,
    legacyFabricInstaller,
    ornitheInstaller,
    liteloaderInstaller,
    riftInstaller,
    nilloaderInstaller,
    optifineDownloader,
    versionService,
    javaRuntimeService,
    logger: logger.child('launch'),
  });

  const loaderSupport = Object.freeze({
    'legacy-fabric': () => legacyFabricInstaller.listSupportedGameVersions(),
    ornithe: () => ornitheInstaller.listSupportedGameVersions(),
    liteloader: () => liteloaderInstaller.listSupportedGameVersions(),
    rift: () => Promise.resolve(riftInstaller.listSupportedGameVersions()),
  });

  const recommendedServersService = createRecommendedServersService();

  return Object.freeze({
    paths,
    logger,
    authService,
    versionService,
    legacyFabricInstaller,
    loaderSupport,
    launchService,
    recommendedServersService,
  });
}

module.exports = { buildContainer };
