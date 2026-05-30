'use strict';

const fs = require('fs');
const path = require('path');

const jarDir = path.join(__dirname, '..', 'bundled-mods', 'marsana-client');
const jars = fs.existsSync(jarDir)
  ? fs.readdirSync(jarDir).filter((f) => f.endsWith('.jar'))
  : [];

if (jars.length === 0) {
  console.warn(
    '[marsana] Uyari: bundled-mods/marsana-client/*.jar yok. ' +
      'Oyun icinde H menusu icin once: npm run build:client-mod (Java 21 gerekir)'
  );
} else {
  console.log(`[marsana] Client mod jar hazir: ${jars.join(', ')}`);
}
