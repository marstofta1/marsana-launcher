'use strict';

const ATERNOS_DASHBOARD = 'https://aternos.org/servers/';

const SERVERS = Object.freeze([
  Object.freeze({
    id: 'marsana-main',
    name: 'Marsana Resmi Sunucu',
    host: 'marstral132.aternos.me',
    port: 25565,
    provider: 'aternos',
    providerDashboardUrl: ATERNOS_DASHBOARD,
    websiteUrl: null,
    capacity: 10,
    description:
      'Ücretsiz 10 kişilik Aternos sunucusu. Sunucu boştayken otomatik uyur; bağlanmadan önce panelden başlatman gerekebilir.',
  }),
  Object.freeze({
    id: 'ultimismc',
    name: 'UltimisMC',
    host: 'play.ultimismc.com',
    port: 25565,
    provider: 'community',
    providerDashboardUrl: null,
    websiteUrl: 'https://ultimismc.com',
    capacity: null,
    description:
      'Türkiye’nin popüler topluluk sunucularından biri. 7/24 açıktır, çeşitli oyun modları sunar.',
  }),
  Object.freeze({
    id: 'mineberry',
    name: 'MineBerry',
    host: 'play.mineberry.net',
    port: 25565,
    provider: 'community',
    providerDashboardUrl: null,
    websiteUrl: 'https://mineberry.net',
    capacity: null,
    description:
      'Aktif Türk topluluğu sunucusu. SkyBlock, SkyWars ve mini oyunlar mevcut.',
  }),
  Object.freeze({
    id: 'mineplus',
    name: 'MinePlus',
    host: 'mineplus.com.tr',
    port: 25565,
    provider: 'community',
    providerDashboardUrl: null,
    websiteUrl: 'https://mineplus.com.tr',
    capacity: null,
    description:
      'Türk yapımı topluluk sunucusu. Survival ve çeşitli oyun modları sunar.',
  }),
  Object.freeze({
    id: 'minepeak',
    name: 'MinePeak',
    host: 'play.minepeak.com',
    port: 25565,
    provider: 'community',
    providerDashboardUrl: null,
    websiteUrl: 'https://minepeak.com',
    capacity: null,
    description:
      '7/24 çevrimiçi topluluk sunucusu. Farklı oyun modları ve etkinlikler.',
  }),
]);

function addressOf(server) {
  if (!server.port || server.port === 25565) return server.host;
  return `${server.host}:${server.port}`;
}

function publicView(server) {
  return Object.freeze({
    id: server.id,
    name: server.name,
    address: addressOf(server),
    host: server.host,
    port: server.port,
    provider: server.provider,
    providerDashboardUrl: server.providerDashboardUrl,
    websiteUrl: server.websiteUrl,
    capacity: server.capacity,
    description: server.description,
  });
}

function createRecommendedServersService() {
  function list() {
    return SERVERS.map(publicView);
  }

  function get(id) {
    const s = SERVERS.find((x) => x.id === id);
    return s ? publicView(s) : null;
  }

  return { list, get };
}

module.exports = { createRecommendedServersService };
