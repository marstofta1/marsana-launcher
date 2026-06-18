/** Minecraft sürümüne göre önerilen Modrinth shader slug'ları (Iris). */
export const VERSION_SHADER_PRESETS = Object.freeze([
  // Complementary Reimagined: 26.2'de Iris ile dogrulanmis kararli paket (E-LITE yarim ekran hatasi veriyor).
  { match: /^26\.2/, slug: 'complementary-reimagined' },
]);

export function recommendedShaderForVersion(versionId) {
  const v = String(versionId || '').trim();
  if (!v) return null;
  for (const { match, slug } of VERSION_SHADER_PRESETS) {
    if (match.test(v)) return slug;
  }
  return null;
}
