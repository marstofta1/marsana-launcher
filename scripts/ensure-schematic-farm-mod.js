'use strict';

const fs = require('fs');
const path = require('path');

const jarDir = path.join(__dirname, '..', 'bundled-mods', 'schematic-farm');
const jars = fs.existsSync(jarDir)
  ? fs.readdirSync(jarDir).filter((f) => f.endsWith('.jar'))
  : [];

if (jars.length === 0) {
  console.warn(
    '[schematic-farm] Uyari: bundled-mods/schematic-farm/*.jar yok. ' +
      'Sematik Farm icin: cd marsana-schematic-farm-mod && gradlew.bat copyToBundled'
  );
} else {
  console.log(`[schematic-farm] Mod jar hazir: ${jars.join(', ')}`);
}
