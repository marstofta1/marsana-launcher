/** Minecraft sürümüne göre önerilen Modrinth shader slug'ları (Iris). */
export const VERSION_SHADER_PRESETS = Object.freeze([
  // E-LITE: Modrinth'te 26.2 için en güncel iris shader paketi (MakeUp tabanlı, yüksek FPS).
  { match: /^26\.2/, slug: 'lite-shaders' },
]);

export function recommendedShaderForVersion(versionId) {
  const v = String(versionId || '').trim();
  if (!v) return null;
  for (const { match, slug } of VERSION_SHADER_PRESETS) {
    if (match.test(v)) return slug;
  }
  return null;
}
