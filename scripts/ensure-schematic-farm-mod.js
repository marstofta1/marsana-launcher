'use strict';

const fs = require('fs');
const path = require('path');

const jarDir = path.join(__dirname, '..', 'bundled-mods', 'schematic-farm');
const linesOut = path.join(__dirname, '..', 'src', 'shared', 'schematicFarmBundledLines.js');

const jars = fs.existsSync(jarDir)
  ? fs.readdirSync(jarDir).filter((f) => f.endsWith('.jar'))
  : [];

const lines = jars
  .map((f) => {
    const m = f.match(/marsana-schematic-farm-(.+)\.jar$/i);
    return m ? m[1] : null;
  })
  .filter(Boolean)
  .sort();

const content = `/** Pakette mevcut Sematik Farm jar satirlari — build:schematic-farm-mod ile guncellenir. */
export const SCHEMATIC_FARM_BUNDLED_LINES = Object.freeze(${JSON.stringify(lines)});

export function schematicFarmLineForVersion(versionId) {
  const v = String(versionId || '').trim();
  if (/^26\\./.test(v)) return '26.1';
  if (/^1\\.22/.test(v)) return '1.22';
  if (/^1\\.21/.test(v)) return '1.21';
  if (/^1\\.20/.test(v)) return '1.20';
  return null;
}

export function schematicFarmJarBundledForVersion(versionId) {
  const line = schematicFarmLineForVersion(versionId);
  return line ? SCHEMATIC_FARM_BUNDLED_LINES.includes(line) : false;
}
`;

fs.writeFileSync(linesOut, content, 'utf8');

if (jars.length === 0) {
  console.warn(
    '[schematic-farm] Uyari: bundled-mods/schematic-farm/*.jar yok. ' +
      'Sematik Farm icin: npm run build:schematic-farm-mod'
  );
} else {
  console.log(`[schematic-farm] Mod jar hazir: ${jars.join(', ')} (satirlar: ${lines.join(', ')})`);
}
