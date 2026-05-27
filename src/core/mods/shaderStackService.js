'use strict';

const path = require('path');
const fs = require('fs');

const { LauncherError, Codes } = require('../infra/errors');

const BUNDLE_FILE = '.marsana-mod-bundle.json';
const READY_FILE = '.marsana-shader-ready.json';

// Anchor mod'ları önce yazıyoruz; dependency çözümlemesi onlardan başlar,
// böylece Iris/Continuity istedikleri Sodium sürümünü kilitler.
const SHADER_FPS_SLUGS = Object.freeze(['iris', 'sodium', 'fabric-api']);
const EMBOSSED_SLUGS = Object.freeze(['continuity', 'sodium', 'fabric-api']);
const DEFAULT_SHADER_SLUG = 'complementary-reimagined';
const OPTIFINE_PROJECT = 'optifine-for-fabric';

// UI'dan gelen shader slug'ını kabul edilen değerlere kıs — geçersiz/eski bir
// slug Modrinth'te 404'e dönüp tüm launch'u patlatabilir. Tanınmayan slug
// için sessizce default'a düş.
const KNOWN_SHADER_SLUGS = new Set([
  'complementary-reimagined', 'complementary-unbound', 'bsl-shaders',
  'photon-shader', 'solas-shader', 'bliss-shader', 'rethinking-voxels',
  'makeup-ultra-fast-shaders', 'super-duper-vanilla', 'insanity-shader',
  'pastel-shaders', 'mellow', 'astralex', 'nostalgia-shader',
  'miniature-shader', 'vanillaa', 'hysteria-shaders', 'kappa-shader',
  'spooklementary',
]);

function resolveShaderSlug(requested) {
  if (typeof requested === 'string' && KNOWN_SHADER_SLUGS.has(requested)) return requested;
  return DEFAULT_SHADER_SLUG;
}

function customIdFor(gameVersion, presets) {
  if (presets.optifine) return `marsana-optifine-${gameVersion}`;
  return `marsana-shader-${gameVersion}`;
}

function normalizePresets(p) {
  return {
    shaderFps: !!(p && p.shaderFps),
    embossedBlocks: !!(p && p.embossedBlocks),
    optifine: !!(p && p.optifine),
  };
}

function modrinthSlugsForPresets(p) {
  if (p.optifine) {
    return [];
  }
  const out = [];
  const seen = new Set();
  const add = (slug) => {
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push(slug);
    }
  };
  if (p.shaderFps) SHADER_FPS_SLUGS.forEach(add);
  if (p.embossedBlocks) EMBOSSED_SLUGS.forEach(add);
  return out;
}

// OptiFine modpack'i Continuity gibi opsiyonel modları `*.jar.disabled` olarak
// getiriyor. Kullanıcı "kabartma" preset'ini de seçtiyse bu modları etkinleştir.
const OPTIFINE_EMBOSSED_MOD_PREFIXES = Object.freeze(['continuity']);

function enableOptifineEmbossedMods(modsDir) {
  if (!fs.existsSync(modsDir)) return [];
  const enabled = [];
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.endsWith('.jar.disabled')) continue;
    const lower = entry.toLowerCase();
    if (!OPTIFINE_EMBOSSED_MOD_PREFIXES.some((p) => lower.startsWith(p))) continue;
    const from = path.join(modsDir, entry);
    const to = path.join(modsDir, entry.slice(0, -'.disabled'.length));
    fs.renameSync(from, to);
    enabled.push(path.basename(to));
  }
  return enabled;
}

// Continuity'nin yan-yana bağlı doku (CTM) etkisi ancak built-in resource
// pack'leri Minecraft'ın `options.txt` `resourcePacks` listesinde yer aldığında
// görünür. Mod yokken Minecraft bu paketleri otomatik kaldırıyor, mod tekrar
// yüklendiğinde geri eklemiyor.
const CONTINUITY_PACKS = Object.freeze(['continuity:default', 'continuity:glass_pane_culling_fix']);

function ensureContinuityResourcePacks(gameRoot) {
  const optionsPath = path.join(gameRoot, 'options.txt');
  if (!fs.existsSync(optionsPath)) return;
  const original = fs.readFileSync(optionsPath, 'utf8');
  const match = original.match(/^resourcePacks:(.*)$/m);
  if (!match) return;
  let arr;
  try {
    arr = JSON.parse(match[1].trim());
  } catch {
    return;
  }
  if (!Array.isArray(arr)) return;
  const missing = CONTINUITY_PACKS.filter((p) => !arr.includes(p));
  if (missing.length === 0) return;
  const vanillaIdx = arr.indexOf('vanilla');
  const insertAt = vanillaIdx >= 0 ? vanillaIdx + 1 : 0;
  arr.splice(insertAt, 0, ...missing);
  const updated = original.replace(/^resourcePacks:.*$/m, `resourcePacks:${JSON.stringify(arr)}`);
  fs.writeFileSync(optionsPath, updated, 'utf8');
}

function presetsMatch(saved, wanted) {
  if (
    !saved ||
    typeof saved.shaderFps !== 'boolean' ||
    typeof saved.embossedBlocks !== 'boolean' ||
    typeof saved.optifine !== 'boolean'
  ) {
    return false;
  }
  return (
    saved.shaderFps === wanted.shaderFps &&
    saved.embossedBlocks === wanted.embossedBlocks &&
    saved.optifine === wanted.optifine
  );
}

function readBundle(modsDir) {
  const p = path.join(modsDir, BUNDLE_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeBundle(modsDir, data) {
  fs.writeFileSync(path.join(modsDir, BUNDLE_FILE), JSON.stringify(data, null, 2), 'utf8');
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function allFilesExist(base, names) {
  if (!Array.isArray(names)) return true;
  return names.every((n) => n && fs.existsSync(path.join(base, n)));
}

function statusEmitter(emit) {
  return (text) => emit && emit.status && emit.status({ text });
}

function createShaderStackService({ httpClient, fabricInstaller, modrinthClient, mrpackInstaller }) {
  function cachedReady({ versionDir, modsDir, shaderpacksDir, gameVersion, versionJsonPath, readyPath, modPresets }) {
    const existing = readBundle(modsDir);
    if (
      !existing ||
      !presetsMatch(existing.presets, modPresets) ||
      !fs.existsSync(versionJsonPath) ||
      !fs.existsSync(readyPath) ||
      existing.gameVersion !== gameVersion ||
      !allFilesExist(modsDir, existing.jars) ||
      !allFilesExist(shaderpacksDir, existing.shaderpacks || [])
    ) {
      return null;
    }
    let assetIndexId = existing.assetIndexId;
    if (!assetIndexId) {
      try {
        const merged = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        assetIndexId = merged.assetIndex?.id || gameVersion;
      } catch {
        assetIndexId = gameVersion;
      }
    }
    return { customId: customIdFor(gameVersion, modPresets), assetIndexId };
  }

  async function installFabricProfile({ gameVersion, customId, versionDir, versionJsonPath }) {
    const { merged, loaderVersion } = await fabricInstaller.buildMergedProfile(gameVersion);
    merged.id = customId;
    await fs.promises.mkdir(versionDir, { recursive: true });
    fs.writeFileSync(versionJsonPath, JSON.stringify(merged, null, 2), 'utf8');
    return { merged, loaderVersion };
  }

  // MCLC, Minecraft 1.21+'in numerik asset index ID'sini (örn. "30") gameVersion
  // adıyla kaydedebiliyor; sonuç olarak oyun aradığı `<id>.json`'u bulamayıp
  // panorama, diller ve sesleri yükleyemiyor. Eksikse Mojang'dan indirip
  // doğru isimle yerleştir.
  async function ensureAssetIndexFile({ gameRoot, assetIndex }) {
    if (!assetIndex || !assetIndex.id || !assetIndex.url) return;
    const indexesDir = path.join(gameRoot, 'assets', 'indexes');
    await fs.promises.mkdir(indexesDir, { recursive: true });
    const targetPath = path.join(indexesDir, `${assetIndex.id}.json`);
    if (fs.existsSync(targetPath)) return;
    await httpClient.download(assetIndex.url, targetPath);
  }

  function cleanupPreviousBundle({ modsDir, shaderpacksDir }) {
    const prev = readBundle(modsDir);
    if (!prev) return;
    for (const jar of prev.jars || []) removeIfExists(path.join(modsDir, jar));
    for (const pack of prev.shaderpacks || []) removeIfExists(path.join(shaderpacksDir, pack));
  }

  // Mojang'ın base sürümleri (1.20, 1.21, 1.19) için mod ekosistemi genelde
  // patch sürümünü (1.20.1, 1.21.1, ...) hedefler — base'ten ilk patch'e mod
  // güncellemesi gelir. Anchor sorgusunu expand edersek Modrinth daha güncel ve
  // birbiriyle uyumlu sürümleri döner.
  function expandGameVersion(v) {
    const m = String(v).match(/^(\d+\.\d+)$/);
    if (m) return [v, `${v}.1`];
    return [v];
  }

  // Modlar arası "latest" sürümler bazen birbiriyle uyumsuz olabilir (örn. Iris
  // 1.6.11 Modrinth manifest'inde Sodium 0.5.7'yi gösterir ama jar içindeki
  // breaks Sodium >=0.5.7'yi çakışmalı sayar). Çözüm katmanları:
  //  - gameVersion'ı patch ile expand et — yeni anchor'lar gelir.
  //  - Anchor mod (Iris/Continuity) önce çek.
  //  - Anchor'ın Modrinth `dependencies` listesindeki spesifik `version_id`'leri
  //    indir; null ise anchor'ın yayın tarihinden önceki en son uyumlu sürümü
  //    al (contemporary heuristic).
  //  - Aynı projenin tekrar indirilmesini engellemek için downloaded set tutulur.
  async function downloadModsFromSlugs({ modsDir, gameVersion, slugs, modrinthLoaders }) {
    const loaderFilter = Array.isArray(modrinthLoaders) && modrinthLoaders.length
      ? modrinthLoaders
      : ['fabric'];
    await fs.promises.mkdir(modsDir, { recursive: true });
    const jars = [];
    const downloadedVersionIds = new Set();
    const downloadedProjectIds = new Set();

    function pickByDate(list, anchorTs) {
      if (!Array.isArray(list) || list.length === 0) return null;
      const eligible = list
        .filter((v) => v.date_published && Date.parse(v.date_published) <= anchorTs)
        .sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published));
      return eligible[0] || null;
    }

    // gameVersion için Modrinth'te bazen anchor'la uyumlu bağımlı sürüm yok
    // (örn. Iris 1.6.11 "1.20" tag'inde, Sodium 0.5.3 "1.20.1" tag'inde). Önce
    // sıkı filtreyle dene, bulamazsan gameVersion filtresini düşür ve aynı
    // dönemden bir sürüm seç (1.20 ↔ 1.20.1 patch sürümleri genelde uyumlu).
    async function findContemporaryVersion(projectId, anchorPublishedIso) {
      const anchorTs = Date.parse(anchorPublishedIso || '') || Date.now();
      const strictList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
        gameVersions: expandGameVersion(gameVersion),
      });
      const strictPick = pickByDate(strictList, anchorTs);
      if (strictPick) return strictPick;

      const looseList = await modrinthClient.listProjectVersions(projectId, {
        loaders: loaderFilter,
      });
      return pickByDate(looseList, anchorTs);
    }

    async function persistVersion(version) {
      if (!version || downloadedVersionIds.has(version.id)) return;
      const file = modrinthClient.primaryFileOf(version);
      if (!file) return;
      downloadedVersionIds.add(version.id);
      if (version.project_id) downloadedProjectIds.add(version.project_id);
      await httpClient.download(file.url, path.join(modsDir, file.filename));
      jars.push(file.filename);

      for (const dep of version.dependencies || []) {
        if (dep.dependency_type !== 'required') continue;
        if (dep.project_id && downloadedProjectIds.has(dep.project_id)) continue;
        let depVersion = null;
        if (dep.version_id) {
          depVersion = await modrinthClient.versionById(dep.version_id);
        } else if (dep.project_id) {
          depVersion = await findContemporaryVersion(dep.project_id, version.date_published);
        }
        if (depVersion) await persistVersion(depVersion);
      }
    }

    for (const slug of slugs) {
      let version;
      try {
        version = await modrinthClient.latestVersion(slug, {
          loaders: loaderFilter,
          gameVersions: expandGameVersion(gameVersion),
        });
      } catch (err) {
        if (err && err.code === Codes.MODRINTH_NOT_FOUND) {
          throw new LauncherError(
            Codes.MODRINTH_NOT_FOUND,
            `Bu Minecraft sürümü (${gameVersion}) için "${slug}" modunun ${loaderFilter.join('/')} uyumlu sürümü Modrinth'te yok. ` +
              'Snapshot/henüz yayınlanmamış sürümlerde bu modlar olmaz — stable bir release (örn. 1.21.4, 1.20.1) seçin.'
          );
        }
        throw err;
      }
      if (version.project_id && downloadedProjectIds.has(version.project_id)) continue;
      await persistVersion(version);
    }
    return jars;
  }

  async function downloadShaderPack({ shaderpacksDir, gameVersion, loaders, shaderSlug }) {
    const expanded = (function expand(v) {
      const m = String(v).match(/^(\d+\.\d+)$/);
      return m ? [v, `${v}.1`] : [v];
    })(gameVersion);
    const loaderFilter = Array.isArray(loaders) && loaders.length ? loaders : ['iris'];
    const slug = resolveShaderSlug(shaderSlug);
    try {
      const file = await modrinthClient.latestPrimaryFile(slug, {
        loaders: loaderFilter,
        gameVersions: expanded,
      });
      await fs.promises.mkdir(shaderpacksDir, { recursive: true });
      await httpClient.download(file.url, path.join(shaderpacksDir, file.filename));
      return [file.filename];
    } catch {
      // Seçili shader bu sürümde yoksa, default Complementary Reimagined'a düş.
      if (slug !== DEFAULT_SHADER_SLUG) {
        try {
          const fallback = await modrinthClient.latestPrimaryFile(DEFAULT_SHADER_SLUG, {
            loaders: loaderFilter,
            gameVersions: expanded,
          });
          await fs.promises.mkdir(shaderpacksDir, { recursive: true });
          await httpClient.download(fallback.url, path.join(shaderpacksDir, fallback.filename));
          return [fallback.filename];
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  // Iris shader paketi otomatik aktivasyonu: indirilen pack zaten varsa kullanıcının
  // Options → Video → Shader Packs menüsüne girip seçmesi gerekmesin. Iris ilk açılışta
  // boş bir `shaderPack=` yazıyor; mevcut satırı (varsa) güncelle, yoksa ekle.
  function writeShaderPropertiesFile(propsPath, shaderpackFilename) {
    let body = '';
    if (fs.existsSync(propsPath)) {
      body = fs.readFileSync(propsPath, 'utf8');
    } else {
      fs.mkdirSync(path.dirname(propsPath), { recursive: true });
    }
    const lines = body.split(/\r?\n/);
    let touched = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^shaderPack\s*=/.test(lines[i])) {
        lines[i] = `shaderPack=${shaderpackFilename}`;
        touched = true;
        break;
      }
    }
    if (!touched) lines.push(`shaderPack=${shaderpackFilename}`);
    if (!lines.some((l) => /^enableShaders\s*=/.test(l))) lines.push('enableShaders=true');
    fs.writeFileSync(propsPath, lines.join('\n'), 'utf8');
  }

  function activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'iris.properties'), shaderpackFilename);
  }

  // Oculus (Iris'in Forge/NeoForge fork'u) kendi config dosyasını kullanır:
  // `config/oculus.properties`. Format Iris ile aynı.
  function activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    writeShaderPropertiesFile(path.join(gameRoot, 'config', 'oculus.properties'), shaderpackFilename);
  }

  // OptiFine'ın shader config dosyası ayrı: `optionsshaders.txt`. Format ana
  // options.txt'e benzer ama OptiFine bunu shader pack seçimi için okur.
  function activateShaderPackInOptifineConfig({ gameRoot, shaderpackFilename }) {
    if (!shaderpackFilename) return;
    const optionsPath = path.join(gameRoot, 'optionsshaders.txt');
    let body = '';
    if (fs.existsSync(optionsPath)) body = fs.readFileSync(optionsPath, 'utf8');
    const lines = body ? body.split(/\r?\n/) : [];
    let touched = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^shaderPack:/.test(lines[i])) {
        lines[i] = `shaderPack:${shaderpackFilename}`;
        touched = true;
        break;
      }
    }
    if (!touched) lines.push(`shaderPack:${shaderpackFilename}`);
    fs.writeFileSync(optionsPath, lines.join('\n'), 'utf8');
  }

  // Forge / NeoForge için launch öncesi eski shader mod jar'larını temizle.
  // Aynı kategoride iki sürüm (örn. Rubidium + Embeddium ya da Oculus + Iris)
  // duplicate hatası verir — sıfırdan kuruyoruz ki tutarlı kombinasyon olsun.
  //
  // ÖNEMLİ: hem aktif `.jar` hem stash kopyalarını siliyoruz. Aksi halde
  // applyLoaderModsState bir sonraki loader geçişinde eski stash'i restore
  // edip eski Rubidium'u geri getirir ve yeni Embeddium ile çakışır.
  const FORGE_FAMILY_SHADER_PREFIXES = ['oculus', 'rubidium', 'embeddium', 'iris', 'sodium'];
  function cleanupForgeFamilyShaderJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_FAMILY_SHADER_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  // Forge ailesinde kabartma için yönetilen jar'lar: Continuity (Forge/NeoForge).
  const FORGE_FAMILY_EMBOSSED_PREFIXES = ['continuity'];
  function cleanupForgeFamilyEmbossedJars(modsDir) {
    if (!fs.existsSync(modsDir)) return;
    for (const entry of fs.readdirSync(modsDir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_FAMILY_EMBOSSED_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(modsDir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  // Forge ailesi loader'lar için (Forge, NeoForge, Forge+OptiFine) shader
  // yığınını yükle. Profile yaratımı bu fonksiyonda DEĞİL — forgeInstaller /
  // neoforgeInstaller bunu zaten yapıyor. Burada sadece modlar + shader pack
  // + ilgili config aktivasyonu.
  //
  // loader değerleri:
  //   'forge'           → oculus + rubidium + Complementary (eski sürümler)
  //   'neoforge'        → iris + sodium (Modrinth NeoForge desteği) + Complementary
  //   'forge-optifine'  → sadece Complementary shader pack (OptiFine kendi shader sistemini içerir)
  async function installShadersForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const status = statusEmitter(emit);

    // Eski shader mod kombinasyonlarını temizle — duplicate riskini önler.
    if (loader === 'forge' || loader === 'neoforge') {
      cleanupForgeFamilyShaderJars(modsDir);
    }

    if (loader === 'forge-optifine') {
      status('Shader paketi indiriliyor (OptiFine için)...');
      const packs = await downloadShaderPack({
        shaderpacksDir,
        gameVersion,
        loaders: ['optifine', 'iris'],
      });
      if (packs[0]) {
        activateShaderPackInOptifineConfig({ gameRoot, shaderpackFilename: packs[0] });
      }
      return { jars: [], shaderpacks: packs };
    }

    // Anchor mod yeterli — Modrinth'in `dependencies` listesi Sodium/Embeddium
    // gibi gerekli bağımlılıkları zaten getiriyor. Ek slug yazarsak bir
    // projenin iki sürümünü (örn. Rubidium + Embeddium) yan yana indirebiliriz
    // ve Forge bunu "duplicate mod" diye reddeder.
    const SLUGS_BY_LOADER = {
      forge: ['oculus'],
      neoforge: ['iris'],
      quilt: ['iris'],
    };
    const slugs = SLUGS_BY_LOADER[loader];
    if (!slugs) {
      throw new Error(`installShadersForExternalLoader: desteklenmeyen loader: ${loader}`);
    }

    status(`Shader modları indiriliyor (${loader})...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs,
      modrinthLoaders: [loader],
    });

    status('Complementary Reimagined shader paketi indiriliyor...');
    const packs = await downloadShaderPack({
      shaderpacksDir,
      gameVersion,
      loaders: ['iris'], // Oculus de Iris API'sini kullanır, aynı paket
    });
    if (packs[0]) {
      if (loader === 'forge') {
        // Oculus kendi config dosyasını okur (oculus.properties), iris.properties değil.
        activateShaderPackInOculusConfig({ gameRoot, shaderpackFilename: packs[0] });
      } else {
        // NeoForge ve Quilt: gerçek Iris mod'u → iris.properties
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: packs[0] });
      }
    }
    return { jars, shaderpacks: packs };
  }

  // Forge ailesi loader'lar için kabartmalı blok (CTM) modunu yükle.
  //   'forge'           → Continuity Forge (sadece 1.20.1; Modrinth'te tek sürüm)
  //   'neoforge'        → Continuity NeoForge (sadece 1.21.1; tek sürüm)
  //   'forge-optifine'  → no-op (OptiFine kendi içinde CTM destekler)
  async function installEmbossedForExternalLoader({ loader, gameRoot, gameVersion, emit }) {
    const modsDir = path.join(gameRoot, 'mods');
    const status = statusEmitter(emit);

    if (loader === 'forge-optifine') {
      status('Kabartma: OptiFine kendi içinde bağlı doku desteği sağlıyor — ek mod indirilmedi.');
      return { jars: [] };
    }
    if (loader === 'neoforge') {
      // NeoForge'da Continuity native değil — sadece Sinytra Connector ile
      // çalışan Fabric jar'ı ve bu kombinasyon NeoForge 21.1.x ile
      // ClassCastException (ModFileParser$MixinConfig) atıyor. Indirmeyi
      // atla, kullanıcıyı bilgilendir.
      status('Kabartma: NeoForge bu sürümde Continuity\'yi native desteklemiyor — atlandı.');
      return { jars: [] };
    }
    if (loader !== 'forge') {
      throw new Error(`installEmbossedForExternalLoader: desteklenmeyen loader: ${loader}`);
    }

    cleanupForgeFamilyEmbossedJars(modsDir);

    status(`Kabartma (Continuity ${loader}) indiriliyor...`);
    const jars = await downloadModsFromSlugs({
      modsDir,
      gameVersion,
      slugs: ['continuity'],
      modrinthLoaders: [loader],
    });

    // options.txt'e Continuity resource pack'lerini ekle — Continuity 3.0+ kendi
    // built-in resource pack'lerini sunar ama Minecraft options'ta listelenmek
    // zorundadır, aksi takdirde CTM görünmez.
    ensureContinuityResourcePacks(gameRoot);

    return { jars };
  }

  async function ensure({ gameRoot, gameVersion, emit, modPresets }) {
    const presets = normalizePresets(modPresets);
    if (!presets.shaderFps && !presets.embossedBlocks && !presets.optifine) {
      throw new Error('shaderStackService.ensure: en az bir mod önayarı gerekli');
    }

    const status = statusEmitter(emit);
    const customId = customIdFor(gameVersion, presets);
    const versionDir = path.join(gameRoot, 'versions', customId);
    const modsDir = path.join(gameRoot, 'mods');
    const shaderpacksDir = path.join(gameRoot, 'shaderpacks');
    const versionJsonPath = path.join(versionDir, `${customId}.json`);
    const readyPath = path.join(versionDir, READY_FILE);

    const cached = cachedReady({
      versionDir,
      modsDir,
      shaderpacksDir,
      gameVersion,
      versionJsonPath,
      readyPath,
      modPresets: presets,
    });
    if (cached) {
      status('Mod profili (önbellek): hazır, başlatılıyor...');
      return cached;
    }

    status(`Mod profili: Fabric yükleyici eşleştiriliyor (${gameVersion})...`);
    const { merged, loaderVersion } = await installFabricProfile({
      gameVersion,
      customId,
      versionDir,
      versionJsonPath,
    });
    await ensureAssetIndexFile({ gameRoot, assetIndex: merged.assetIndex });

    status('Mod profili: seçilen modlar indiriliyor...');
    cleanupPreviousBundle({ modsDir, shaderpacksDir });

    let optifineMeta = null;
    if (presets.optifine) {
      optifineMeta = await mrpackInstaller.installFromProject({
        projectSlug: OPTIFINE_PROJECT,
        gameVersion,
        gameRoot,
        emit,
      });
    }

    const slugs = modrinthSlugsForPresets(presets);
    let jars = slugs.length ? await downloadModsFromSlugs({ modsDir, gameVersion, slugs }) : [];
    if (optifineMeta && Array.isArray(optifineMeta.jarNames)) {
      const seen = new Set(jars);
      for (const name of optifineMeta.jarNames) {
        if (!seen.has(name)) {
          seen.add(name);
          jars.push(name);
        }
      }
    }
    if (presets.optifine && presets.embossedBlocks) {
      const enabled = enableOptifineEmbossedMods(modsDir);
      const seen = new Set(jars);
      for (const name of enabled) {
        if (!seen.has(name)) {
          seen.add(name);
          jars.push(name);
        }
      }
    }

    if (presets.embossedBlocks) {
      ensureContinuityResourcePacks(gameRoot);
    }

    let shaderpacks = [];
    if (presets.shaderFps && !presets.optifine) {
      status('Mod profili: Complementary Reimagined shader paketi indiriliyor...');
      shaderpacks = await downloadShaderPack({ shaderpacksDir, gameVersion });
      if (shaderpacks[0]) {
        activateShaderPackInIrisConfig({ gameRoot, shaderpackFilename: shaderpacks[0] });
      }
    }

    const assetIndexId = merged.assetIndex?.id || gameVersion;

    fs.writeFileSync(
      readyPath,
      JSON.stringify(
        { gameVersion, customId, assetIndexId, loader: loaderVersion, readyAt: Date.now(), presets },
        null,
        2
      ),
      'utf8'
    );
    writeBundle(modsDir, {
      gameVersion,
      loader: loaderVersion,
      jars,
      shaderpacks,
      assetIndexId,
      presets,
      optifineMeta,
      updatedAt: Date.now(),
    });

    if (presets.optifine) {
      const packLabel = optifineMeta && optifineMeta.packName ? optifineMeta.packName : 'OptiFine for Fabric';
      status(
        `${packLabel} kuruldu. Video ayarları ve shader seçenekleri paket içindeki modlarla gelir; ` +
          'Shader + FPS seçeneğiyle birlikte kullanmayın.'
      );
    } else if (presets.shaderFps && presets.embossedBlocks) {
      status(
        'Mod profili hazır. Shader: Seçenekler → Video → Shader Packs (Complementary’de Performance önerilir). ' +
          'Kabartma: Continuity + Sodium.'
      );
    } else if (presets.shaderFps) {
      status(
        'Shader + FPS profili hazır. Oyun içinde: Seçenekler → Video → Shader Packs; Complementary’de Performance profili önerilir.'
      );
    } else {
      status('Kabartmalı blok / bağlı doku: Continuity + Sodium hazır.');
    }

    return { customId, assetIndexId };
  }

  return { ensure, installShadersForExternalLoader, installEmbossedForExternalLoader };
}

module.exports = { createShaderStackService };
