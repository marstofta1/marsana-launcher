'use strict';

/**
 * Marsana Client HUD paketi — Modrinth client-side mod slug listesi.
 * 26.x'te uyumlu surum yoksa indirme atlanir (optional).
 *
 * CLIENT_HUD_REQUIRED_SLUGS: BetterF3, Visuality vb. icin zorunlu kutuphaneler;
 * bulunamazsa paket kurulumu hata verir (sessizce atlanmaz).
 */
const CLIENT_HUD_REQUIRED_SLUGS = Object.freeze(['cloth-config']);

const CLIENT_HUD_MOD_SLUGS = Object.freeze([
  'xaeros-minimap',
  'xaeros-world-map',
  'appleskin',
  'modmenu',
  'betterf3',
  'dynamic-fps',
  'entityculling',
  'lambdynamiclights',
  'shulkerboxtooltip',
  'mousewheelie',
  'skin-layers',
  'not-enough-animations',
  'falling-leaves-fabric',
  'visuality',
  'presence-footsteps',
  'sound-physics-remastered',
  'enhanced-block-entities',
  'chat-heads',
  'wavey-capes',
  'lighty',
  'moreculling',
  'sodium-extra',
  'reese-sodium-options',
  'dynamiccrosshair',
  'hold-that-item',
  'item-highlighter',
  'better-stats',
  'ferritecore',
  'modernfix',
  'fastquit',
  'lazydfu',
  'krypton',
  'no-chat-reports',
  'memoryleakfix',
  'immediatelyfast',
  'fallingtree',
  'inventory-tweaks-renewed',
  'stackdeobfuscator',
  'carpet-fixes',
  'clumps',
  'collective',
  'fabric-language-kotlin',
  'placeholder-api',
  'yacl',
  'controlify',
  'figura',
  'minihud',
  'tweakeroo',
  'malilib',
  'litematica',
  'journeymap',
]);

module.exports = { CLIENT_HUD_MOD_SLUGS, CLIENT_HUD_REQUIRED_SLUGS };
