/** Pakette mevcut Sematik Farm jar satirlari — build:schematic-farm-mod ile guncellenir. */
export const SCHEMATIC_FARM_BUNDLED_LINES = Object.freeze(["26.1"]);

export function schematicFarmLineForVersion(versionId) {
  const v = String(versionId || '').trim();
  if (/^26\./.test(v)) return '26.1';
  if (/^1\.22/.test(v)) return '1.22';
  if (/^1\.21/.test(v)) return '1.21';
  if (/^1\.20/.test(v)) return '1.20';
  return null;
}

export function schematicFarmJarBundledForVersion(versionId) {
  const line = schematicFarmLineForVersion(versionId);
  return line ? SCHEMATIC_FARM_BUNDLED_LINES.includes(line) : false;
}
