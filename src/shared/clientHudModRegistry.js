'use strict';

/**
 * Marsana Client HUD paketi — Modrinth client-side mod slug listesi.
 * 26.x'te uyumlu surum yoksa indirme atlanir (optional).
 *
 * 1.21.x-only modlar (MaLiLib, Litematica, Figura vb.) bilerek listede yok;
 * 26.1.2'de yanlis surum indirilmesini onler.
 */
const CLIENT_HUD_REQUIRED_SLUGS = Object.freeze([
  'cloth-config',
  'fabric-language-kotlin',
  'modmenu',
]);

const CLIENT_HUD_MOD_SLUGS = Object.freeze([
  'xaeros-minimap',
  'xaeros-world-map',
  'appleskin',
  'betterf3',
  'dynamic-fps',
  'shulkerboxtooltip',
  'mousewheelie',
  'skin-layers',
  'not-enough-animations',
  'falling-leaves-fabric',
  'visuality',
  'presence-footsteps',
  'enhanced-block-entities',
  'wavey-capes',
  'lighty',
  'moreculling',
  'sodium-extra',
  'reese-sodium-options',
  'dynamiccrosshair',
  'hold-that-item',
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
  'placeholder-api',
]);

module.exports = { CLIENT_HUD_MOD_SLUGS, CLIENT_HUD_REQUIRED_SLUGS };
