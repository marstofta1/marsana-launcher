'use strict';

const { createMetaLoaderInstaller } = require('./metaLoaderInstaller');

const ORNITHE_META = 'https://meta.ornithemc.net/v2/versions';

function createOrnitheInstaller({ httpClient, versionService }) {
  return createMetaLoaderInstaller({
    httpClient,
    versionService,
    baseUrl: ORNITHE_META,
    unsupportedMessage: 'Ornithe bu Minecraft sürümünü desteklemiyor',
    supportedGameUrl: `${ORNITHE_META}/game`,
    legacyMerge: true,
  });
}

module.exports = { createOrnitheInstaller };
