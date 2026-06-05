'use strict';

/** Maven koordinatindan surum haric anahtar: group:artifact veya group:artifact:classifier */
function libraryArtifactKey(name) {
  const id = String(name || '').trim();
  if (!id) return '';
  const parts = id.split(':');
  if (parts.length < 3) return id;
  if (parts.length >= 4) return `${parts[0]}:${parts[1]}:${parts[3]}`;
  return `${parts[0]}:${parts[1]}`;
}

/** Loader kutuphaneleri ayni artifact icin parent surumunu ezer (orn. asm 9.6 -> 9.10.1). */
function mergeLibraries(parentLibs = [], loaderLibs = []) {
  const map = new Map();
  for (const lib of parentLibs) {
    if (!lib || !lib.name) continue;
    map.set(libraryArtifactKey(lib.name), lib);
  }
  for (const lib of loaderLibs) {
    if (!lib || !lib.name) continue;
    map.set(libraryArtifactKey(lib.name), lib);
  }
  return [...map.values()];
}

function dedupeLibraries(libraries = []) {
  const map = new Map();
  for (const lib of libraries) {
    if (!lib || !lib.name) continue;
    map.set(libraryArtifactKey(lib.name), lib);
  }
  return [...map.values()];
}

module.exports = { libraryArtifactKey, mergeLibraries, dedupeLibraries };
