'use strict';

/**
 * Klima SMP, Marsana resmi sunucusu (Aternos: NeoForge 1.21.1 + Create, Create Aeronautics,
 * Create: Diesel Generators). Launcher'ın "Klima SMP" paketi bu jar'ları birebir kurar: NeoForge'da
 * istemcideki kayıtlar (blok/eşya) sunucununkiyle aynı olmak zorunda, bir modun "en güncel" sürümü
 * sunucudakinden farklı çıkarsa bağlantı reddedilir. Aternos'ta mod sürümü değişirse buradakileri de güncelle.
 */

// Sunucu adresi (ör. "marsana.aternos.me"). Boşken paket modları kurar ama oyunu doğrudan
// sunucuya bağlamaz.
const MARSANA_SERVER_HOST = 'marstral11880-OSWR.aternos.me';
const MARSANA_SERVER_PORT = 25565;
const MARSANA_SERVER_MC_VERSION = '1.21.1';
const MARSANA_SERVER_DASHBOARD_URL = 'https://aternos.org/servers/';

// İstemcide de bulunması gereken, sunucuyla aynı sabit sürümlü modlar. Sunucudaki giriş modu
// (Login System, /register ve /login) yalnızca sunucuda çalışır, istemciye kurulmaz.
const MARSANA_SERVER_PINNED_MODS = Object.freeze([
  Object.freeze({
    slug: 'create',
    versionId: 'UjX6dr61',
    file: 'create-1.21.1-6.0.10.jar',
    url: 'https://cdn.modrinth.com/data/LNytGWDc/versions/UjX6dr61/create-1.21.1-6.0.10.jar',
    sha512:
      '11cc8fc049d2f67f6548c7abfada6b82a3adb5c7ca410a742de04bbca76e03862c518721b88d806f6e6d768a4d68531fdb903a85859b25d1484d550cc7bafd4b',
  }),
  // Create Aeronautics'in fizik kütüphanesi (aeronautics/simulated/offroad bunu ister: [2.0.0,3.0.0)).
  Object.freeze({
    slug: 'sable',
    versionId: 'fg9dTRz9',
    file: 'sable-neoforge-1.21.1-2.0.6.jar',
    url: 'https://cdn.modrinth.com/data/T9PomCSv/versions/fg9dTRz9/sable-neoforge-1.21.1-2.0.6.jar',
    sha512:
      '76d293ce751a01cb9c095a3659b0a41e03e005480bc9d76dfdc73ec7c2eabf7923740c7b077921d42616673c496cd5143569f2085ddcebe174fd91d81e2a04b8',
  }),
  // "bundled" jar Aeronautics + Simulated + Offroad'u içinde taşır.
  Object.freeze({
    slug: 'create-aeronautics',
    versionId: '44pLdPGg',
    file: 'create-aeronautics-bundled-1.21.1-1.3.2.jar',
    url: 'https://cdn.modrinth.com/data/oWaK0Q19/versions/44pLdPGg/create-aeronautics-bundled-1.21.1-1.3.2.jar',
    sha512:
      'dc7e8e1148fa442243889ba29412207137e1bb86206e6c92bc0a589f1374a466e93de22bdbf14f753984d86c29308fbbdc0f14a4b9618b14c0ac1666a36b46f5',
  }),
  Object.freeze({
    slug: 'create-diesel-generators',
    versionId: 'UoPH8lO1',
    file: 'createdieselgenerators-1.21.1-1.3.15.jar',
    url: 'https://cdn.modrinth.com/data/ZM3tt6p1/versions/UoPH8lO1/createdieselgenerators-1.21.1-1.3.15.jar',
    sha512:
      '1507ebcd07d3185aac3ae6ce768b4d6bab16cb6f39776d25a850c8133a4dc5826b8ddbeca112d76afc64deaa37ec177cac4237c6c34621c4b65e73d83f8ab43f',
  }),
]);

/** MCLC `quickPlay` hedefi; sunucu adresi henüz girilmediyse null. */
function marsanaServerQuickPlay() {
  const host = String(MARSANA_SERVER_HOST || '').trim();
  if (!host) return null;
  // Varsayılan portta adres yalın verilir: Aternos gibi hostlar gerçek portu SRV kaydıyla bildirir,
  // açık ":25565" yazılırsa oyun SRV'ye bakmadan yanlış porta bağlanabilir.
  const identifier =
    MARSANA_SERVER_PORT === 25565 ? host : `${host}:${MARSANA_SERVER_PORT}`;
  return { type: 'multiplayer', identifier };
}

module.exports = {
  MARSANA_SERVER_HOST,
  MARSANA_SERVER_PORT,
  MARSANA_SERVER_MC_VERSION,
  MARSANA_SERVER_DASHBOARD_URL,
  MARSANA_SERVER_PINNED_MODS,
  marsanaServerQuickPlay,
};
