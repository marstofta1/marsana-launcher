'use strict';

/**
 * Marsana resmi sunucusu (Aternos: NeoForge 1.21.1 + Create, eklentisiz). Launcher'ın "Marsana
 * Sunucusu" paketi bu jar'ları birebir kurar: NeoForge'da istemcideki kayıtlar (blok/eşya)
 * sunucununkiyle aynı olmak zorunda, Create'in "en güncel" sürümü sunucudakinden farklı çıkarsa
 * bağlantı reddedilir. Aternos'ta mod sürümü değişirse buradakileri de güncelle.
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
