'use strict';

const {
  MARSANA_SERVER_HOST,
  MARSANA_SERVER_PORT,
  MARSANA_SERVER_DASHBOARD_URL,
} = require('../../shared/marsanaServer');

const SERVERS = Object.freeze([
  Object.freeze({
    // Aternos'taki resmi Create sunucusu. Adres girilene kadar listede gösterilmez.
    id: 'marsana-main',
    name: 'Klima SMP',
    host: MARSANA_SERVER_HOST,
    port: MARSANA_SERVER_PORT,
    provider: 'aternos',
    providerDashboardUrl: MARSANA_SERVER_DASHBOARD_URL,
    websiteUrl: null,
    capacity: null,
    description:
      'Ücretsiz Create sunucusu (survival). Boştayken uyur; bağlanmadan önce panelden uyandır. Girmek için "Klima SMP" paketini seç.',
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
  Object.freeze({
    id: 'donutsmp',
    name: 'Donut SMP',
    host: 'donutsmp.net',
    port: 25565,
    provider: 'community',
    providerDashboardUrl: null,
    websiteUrl: 'https://donutsmp.net',
    capacity: null,
    description:
      'Popüler hardcore survival SMP. Java ve Bedrock crossplay; ekonomi, PvP ve liderlik tablosu. (Bedrock port: 19132)',
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
    return SERVERS.filter((s) => s.host).map(publicView);
  }

  function get(id) {
    const s = SERVERS.find((x) => x.id === id && x.host);
    return s ? publicView(s) : null;
  }

  return { list, get };
}

module.exports = { createRecommendedServersService };
