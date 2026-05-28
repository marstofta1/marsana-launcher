function isReleaseStyleVersionId(id) {
  return /^\d+\.\d+(\.\d+)?$/.test(String(id || ''));
}

/** Sadece klasik 1.x.y sürümleri (1.16, 1.20.4); 26.x veya 2.x burada false. */
function isLegacyOneDotSeries(versionId) {
  return /^1\.\d+(\.\d+)?$/.test(String(versionId || ''));
}

function mcMinorAtLeast(versionId, minMinor) {
  const m = String(versionId).match(/^1\.(\d+)/);
  if (!m) return false;
  return parseInt(m[1], 10) >= minMinor;
}

export function shaderFpsSupported(versionId) {
  const v = String(versionId || '').trim();
  if (!v || v === 'Yükleniyor...') return true;
  if (!isReleaseStyleVersionId(v)) return true;
  if (!isLegacyOneDotSeries(v)) return true;
  return mcMinorAtLeast(v, 16);
}

export function embossedBlocksSupported(versionId) {
  const v = String(versionId || '').trim();
  if (!v || v === 'Yükleniyor...') return true;
  if (!isReleaseStyleVersionId(v)) return true;
  if (!isLegacyOneDotSeries(v)) return true;
  return mcMinorAtLeast(v, 18);
}

export function optifineSupported(versionId) {
  return shaderFpsSupported(versionId);
}

// OptiFine'ın resmi olarak desteklediği en yeni Minecraft sürümü 1.21.9.
// Klasik 1.x.y şeması dışı (örn. 26.1.2) sürümlerde OptiFine henüz yok.
export function forgeOptifineLikelySupported(versionId) {
  const v = String(versionId || '').trim();
  if (!v || v === 'Yükleniyor...') return true;
  if (!/^1\.\d+(\.\d+)?$/.test(v)) return false;
  const m = v.match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const minor = parseInt(m[1], 10);
  const patch = m[2] ? parseInt(m[2], 10) : 0;
  if (minor < 21) return true;
  if (minor === 21 && patch <= 9) return true;
  return false;
}

/** Forge + Continuity Modrinth'te yalnızca 1.20.1 için yayınlanıyor. */
export function forgeEmbossedSupported(versionId) {
  return String(versionId || '').trim() === '1.20.1';
}

/** Sürüm seçicide API ile filtrelenen loader kimlikleri. */
export const LOADERS_WITH_VERSION_FILTER = Object.freeze([
  'legacy-fabric',
  'ornithe',
  'liteloader',
  'rift',
]);

const LOADER_EMPTY_MESSAGES = Object.freeze({
  'legacy-fabric': 'Legacy Fabric uyumlu sürüm bulunamadı',
  ornithe: 'Ornithe uyumlu sürüm bulunamadı',
  liteloader: 'LiteLoader uyumlu sürüm bulunamadı',
  rift: 'Rift uyumlu sürüm bulunamadı (1.13 ve 1.13.2)',
});

export function selectionRequiresReleaseVersions({
  loader,
  modOptifine,
  modShaderFps,
  modEmbossedBlocks,
}) {
  if (loader === 'forge-optifine') return true;
  return !!(modOptifine || modShaderFps || modEmbossedBlocks);
}

export function isVersionAllowedForSelection({
  versionId,
  versionType = 'release',
  loader,
  modOptifine,
  modShaderFps,
  modEmbossedBlocks,
  legacyFabricSupportedSet = null,
  loaderSupportedSet = null,
}) {
  const id = String(versionId || '').trim();
  if (!id) return false;

  const loaderVal = loader || 'vanilla';
  const supportedSet = loaderSupportedSet || legacyFabricSupportedSet;

  if (loaderVal === 'legacy-fabric' || loaderVal === 'ornithe' || loaderVal === 'liteloader' || loaderVal === 'rift') {
    if (!supportedSet || !supportedSet.has(id)) return false;
  }

  if (
    selectionRequiresReleaseVersions({
      loader: loaderVal,
      modOptifine,
      modShaderFps,
      modEmbossedBlocks,
    }) &&
    versionType !== 'release'
  ) {
    return false;
  }

  if (loaderVal === 'forge-optifine' && !forgeOptifineLikelySupported(id)) return false;

  if (modOptifine && !optifineSupported(id)) return false;
  if (modShaderFps && !shaderFpsSupported(id)) return false;

  if (modEmbossedBlocks) {
    if (loaderVal === 'forge') {
      if (!forgeEmbossedSupported(id)) return false;
    } else if (loaderVal === 'neoforge' || loaderVal === 'forge-optifine') {
      // NeoForge'da Continuity native değil; Forge+OptiFine kendi CTM'ini sağlar.
    } else if (!embossedBlocksSupported(id)) {
      return false;
    }
  }

  return true;
}

export function getVersionFilterEmptyMessage(state, { legacyFabric = false, loader: loaderOverride = null } = {}) {
  const loaderVal = loaderOverride || state.loader;
  if (legacyFabric || loaderVal === 'legacy-fabric') {
    return LOADER_EMPTY_MESSAGES['legacy-fabric'];
  }
  if (loaderVal && LOADER_EMPTY_MESSAGES[loaderVal]) {
    return LOADER_EMPTY_MESSAGES[loaderVal];
  }

  const { loader, modOptifine, modShaderFps, modEmbossedBlocks } = state;
  const labels = [];
  if (loader === 'forge-optifine' || modOptifine) labels.push('OptiFine');
  if (modShaderFps) labels.push('Shader + FPS');
  if (modEmbossedBlocks) labels.push('Kabartmalı bloklar');

  if (labels.length > 0) {
    return `${labels.join(' ve ')} ile uyumlu sürüm bulunamadı`;
  }
  return 'Sürüm yok';
}
