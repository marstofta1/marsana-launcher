'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const { isMac } = require('../../shared/platform');
const { LauncherError, Codes } = require('../infra/errors');

const MIN_MEM_MB = 1024;
const DEFAULT_MEM_MB = 2048;
const SYSTEM_RESERVE_MB = 512;

function platformJvmArgs() {
  // macOS + LWJGL/GLFW: render thread JVM ana thread'i olmak zorunda.
  // MCLC bu argümanı her zaman version JSON kurallarından doğru türetemiyor,
  // o yüzden zorla ekliyoruz (çift olsa bile zararsız).
  // Windows/Linux: bu bayrak gerekmez ve zararlı olabilir.
  if (isMac) return ['-XstartOnFirstThread'];
  return [];
}

function isForgeFamily(loader) {
  return loader === 'forge' || loader === 'forge-optifine' || loader === 'neoforge';
}

// Forge / NeoForge version JSON'unun `arguments.jvm` listesinde kritik şeyler
// var: `-p` ile modül yolu (BootstrapLauncher Java modüle path'inde olmak
// zorunda), `--add-modules ALL-MODULE-PATH`, `--add-opens` direktifleri,
// `-DignoreList=...` vs. MCLC v3 bunları aktarmıyor, kendimiz çıkarmamız şart.
//
// String entry'leri al, rule object'leri (OS-specific) bizimkinde gereksiz
// — atla. `${library_directory}`, `${classpath_separator}`, `${version_name}`
// placeholder'larını çöz.
function readForgeFamilyJvmArgs({ gameRoot, customId }) {
  const versionsDir = path.join(gameRoot, 'versions', customId);
  const jsonPath = path.join(versionsDir, `${customId}.json`);
  if (!fs.existsSync(jsonPath)) return [];
  let json;
  try {
    json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return [];
  }
  const jvm = (json.arguments && json.arguments.jvm) || [];
  const sep = process.platform === 'win32' ? ';' : ':';
  const subs = {
    library_directory: path.join(gameRoot, 'libraries'),
    classpath_separator: sep,
    version_name: customId,
  };
  const out = [];
  for (const entry of jvm) {
    if (typeof entry !== 'string') continue;
    out.push(entry.replace(/\$\{(\w+)\}/g, (m, k) => (k in subs ? subs[k] : m)));
  }
  return out;
}

function clampMemory(requestedMb) {
  const systemMb = Math.floor(os.totalmem() / 1024 / 1024);
  const upperBound = Math.max(MIN_MEM_MB, systemMb - SYSTEM_RESERVE_MB);
  const requested = requestedMb || DEFAULT_MEM_MB;
  return Math.max(MIN_MEM_MB, Math.min(requested, upperBound));
}

function createLaunchService({
  paths,
  httpClient,
  authService,
  shaderStackService,
  forgeInstaller,
  neoforgeInstaller,
  quiltInstaller,
  legacyFabricInstaller,
  optifineDownloader,
  versionService,
  javaRuntimeService,
  logger,
}) {
  function ensureGameRoot() {
    if (!fs.existsSync(paths.gameRoot)) fs.mkdirSync(paths.gameRoot, { recursive: true });
  }

  // Mojang'ın base sürümleri (1.20, 1.21, 1.19) mod ekosistemi tarafından
  // hedeflenmiyor; modlar `fabric.mod.json` içinde `depends.minecraft = 1.20.1`
  // gibi katı patch sürüm gereksinimi yazıyor. Mod aktifse Minecraft'ı sessizce
  // patch sürümüne upgrade et — protokol ve saves uyumlu, kullanıcının dünyası
  // etkilenmez.
  function effectiveModGameVersion(v) {
    const m = String(v).match(/^(\d+\.\d+)$/);
    return m ? `${v}.1` : v;
  }

  async function buildFabricSpec({ version, modPresets, shaderSlug, emit }) {
    const presets = modPresets || { shaderFps: false, embossedBlocks: false, optifine: false };
    const useFabric = !!(presets.shaderFps || presets.embossedBlocks || presets.optifine);
    if (!useFabric) {
      return { spec: { number: version, type: 'release' }, overrides: { detached: false }, extra: {} };
    }
    const effectiveVersion = effectiveModGameVersion(version);
    if (effectiveVersion !== version && emit && emit.status) {
      emit.status({
        text: `Mod uyumluluğu için Minecraft ${effectiveVersion} kullanılıyor (${version} base'i ile aynı dünya/protokol).`,
      });
    }
    const { customId, assetIndexId } = await shaderStackService.ensure({
      gameRoot: paths.gameRoot,
      gameVersion: effectiveVersion,
      emit,
      modPresets: presets,
      shaderSlug,
    });
    return {
      spec: { number: effectiveVersion, type: 'release', custom: customId },
      overrides: { detached: false, assetIndex: assetIndexId },
      extra: {},
    };
  }

  async function copyOptifineIntoMods({ jarPath, filename }) {
    const modsDir = path.join(paths.gameRoot, 'mods');
    await fs.promises.mkdir(modsDir, { recursive: true });
    const dest = path.join(modsDir, filename);
    if (!fs.existsSync(dest)) {
      await fs.promises.copyFile(jarPath, dest);
    }
    return dest;
  }

  // Loader-bazlı izolasyon: mods/ klasöründe Fabric ve Forge .jar'ları aynı anda
  // bulunamaz, yoksa ClassLoader yanlış manifest'lerle çakışır. Loader geçişinde
  // o anda aktif olan .jar'ları "stash"liyoruz, hedef loader'ın stash'i varsa
  // .jar'a geri alıyoruz.
  const STASHED_FABRIC_SUFFIX = '.marsana-stashed-fabric';
  const STASHED_FORGE_SUFFIX = '.marsana-stashed-forge';

  function modsDir() {
    return path.join(paths.gameRoot, 'mods');
  }

  // Launcher ayarlarında verilen ses seviyelerini Minecraft `options.txt`'e
  // yansıt. Minecraft format: `soundCategory_master:0.75` (0.0-1.0).
  // Dosya yoksa oluşturulur; var olan diğer satırlar korunur.
  function applyAudioSettingsToOptionsTxt(audio) {
    if (!audio) return;
    const optionsPath = path.join(paths.gameRoot, 'options.txt');
    const updates = new Map();
    if (typeof audio.masterVolume === 'number') {
      updates.set('soundCategory_master', audio.masterVolume.toFixed(3));
    }
    if (typeof audio.musicVolume === 'number') {
      updates.set('soundCategory_music', audio.musicVolume.toFixed(3));
    }
    if (updates.size === 0) return;

    let body = '';
    if (fs.existsSync(optionsPath)) {
      body = fs.readFileSync(optionsPath, 'utf8');
    }
    const lines = body ? body.split(/\r?\n/) : [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([^:]+):/);
      if (!m) continue;
      const key = m[1];
      if (updates.has(key)) {
        lines[i] = `${key}:${updates.get(key)}`;
        seen.add(key);
      }
    }
    for (const [key, value] of updates) {
      if (!seen.has(key)) lines.push(`${key}:${value}`);
    }
    fs.writeFileSync(optionsPath, lines.join('\n'), 'utf8');
  }

  function purgeManagedOptifineJars(dir) {
    for (const entry of fs.readdirSync(dir)) {
      if (
        entry.startsWith('OptiFine_') &&
        (entry.endsWith('.jar') ||
          entry.endsWith(STASHED_FABRIC_SUFFIX) ||
          entry.endsWith(STASHED_FORGE_SUFFIX))
      ) {
        try {
          fs.unlinkSync(path.join(dir, entry));
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Forge/NeoForge'a geçişte shader + embossed mod jar'larını her zaman temizle.
  // Stash mantığı bunları bir sonraki run'a taşıyıp eski sürümleri geri yüklüyor;
  // bu da Forge ↔ NeoForge ↔ Forge geçişlerinde tutarsız mod kombinasyonu ve
  // duplicate / javafml sürüm uyumsuzluğu hatasına yol açıyor.
  const FORGE_MANAGED_PREFIXES = [
    'oculus', 'rubidium', 'embeddium', 'iris', 'sodium', 'continuity',
  ];
  function purgeForgeShaderArtifacts(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const lower = entry.toLowerCase();
      if (!FORGE_MANAGED_PREFIXES.some((p) => lower.startsWith(`${p}-`) || lower.startsWith(`${p}_`))) {
        continue;
      }
      try {
        fs.unlinkSync(path.join(dir, entry));
      } catch {
        /* ignore */
      }
    }
  }

  function applyLoaderModsState(target) {
    const dir = modsDir();
    if (!fs.existsSync(dir)) return;

    // OptiFine her zaman launcher tarafından yönetilir: önce sil, gerekliyse
    // ihtiyaç noktasında yeniden kopyalanır.
    purgeManagedOptifineJars(dir);

    // Forge moduna geçişte shader mod artikalarını (active + stash hepsi) sil.
    // installShadersForExternalLoader istenirse uyumlu yeni sürümü indirir;
    // istenmezse Forge boş başlar — eski uyumsuz jar'lar duplicate veya javafml
    // sürüm uyuşmazlığı yaratmaz.
    if (target === 'forge') {
      purgeForgeShaderArtifacts(dir);
    }

    // Geçilen loader Fabric ise: şu anda aktif .jar'lar Forge'a ait → STASHED_FORGE ile sakla,
    // sonra STASHED_FABRIC olanları .jar olarak geri al. Tersi ise tam tersi.
    const stashSuffixForCurrent = target === 'fabric' ? STASHED_FORGE_SUFFIX : STASHED_FABRIC_SUFFIX;
    const restoreSuffix = target === 'fabric' ? STASHED_FABRIC_SUFFIX : STASHED_FORGE_SUFFIX;

    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.jar')) continue;
      fs.renameSync(path.join(dir, entry), path.join(dir, entry + stashSuffixForCurrent));
    }
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(restoreSuffix)) continue;
      const restored = entry.slice(0, -restoreSuffix.length);
      fs.renameSync(path.join(dir, entry), path.join(dir, restored));
    }
  }

  async function buildForgeSpec({ version, includeOptifine, includeShader, includeEmbossed, shaderSlug, javaPath, emit }) {
    // Mod ekosistemi (Embeddium, Oculus, Continuity) Minecraft'ın patch
    // sürümünü hedefler (örn. 1.20.1) ve onunla uyumlu Forge'u (47.x) ister.
    // Kullanıcı base seçti ise (örn. 1.20) bu, javafml sürüm uyumsuzluğuna yol
    // açar. Mod aktifse patch'e upgrade et — protokol/saves uyumlu, sorunsuz.
    const effectiveVersion =
      includeShader || includeOptifine || includeEmbossed
        ? effectiveModGameVersion(version)
        : version;
    if (effectiveVersion !== version && emit && emit.status) {
      emit.status({
        text: `Forge mod uyumluluğu için Minecraft ${effectiveVersion} kullanılıyor (${version} base'i ile aynı dünya/protokol).`,
      });
    }

    // OptiFine ile Forge'un binary uyumlu olması için OptiFine sayfasının
    // önerdiği spesifik Forge sürümünü kullanmak şart. Önce OptiFine jar'ını
    // ve onun istediği Forge sürümünü öğren, ondan sonra Forge'u o sürümle kur.
    let optifineMeta = null;
    if (includeOptifine) {
      optifineMeta = await optifineDownloader.ensureJarFor({ mcVersion: effectiveVersion, emit });
      if (optifineMeta.requiredForgeVersion) {
        logger.info('OptiFine requires specific Forge version', {
          forge: optifineMeta.requiredForgeVersion,
          optifine: optifineMeta.filename,
        });
      }
    }

    const { customId, forgeVersion } = await forgeInstaller.ensureInstalled({
      mcVersion: effectiveVersion,
      forgeVersionOverride: optifineMeta && optifineMeta.requiredForgeVersion,
      gameRoot: paths.gameRoot,
      javaPath,
      emit,
    });
    logger.info('Forge profile ready', { effectiveVersion, forgeVersion, customId });

    if (optifineMeta) {
      await copyOptifineIntoMods({ jarPath: optifineMeta.jarPath, filename: optifineMeta.filename });
      logger.info('OptiFine jar staged in mods/', { filename: optifineMeta.filename });
    }

    if (includeShader) {
      await shaderStackService.installShadersForExternalLoader({
        loader: includeOptifine ? 'forge-optifine' : 'forge',
        gameRoot: paths.gameRoot,
        gameVersion: effectiveVersion,
        emit,
        shaderSlug,
      });
    }

    if (includeEmbossed) {
      await shaderStackService.installEmbossedForExternalLoader({
        loader: includeOptifine ? 'forge-optifine' : 'forge',
        gameRoot: paths.gameRoot,
        gameVersion: effectiveVersion,
        emit,
      });
    }

    return {
      spec: { number: effectiveVersion, type: 'release', custom: customId },
      overrides: { detached: false },
      extra: {},
    };
  }

  // Quilt için asset index dosyasını Mojang'tan indir (Minecraft 1.21+ numerik
  // ID şemasında MCLC bazen yanlış adla kaydedip oyunun aramasını boş bırakır).
  async function ensureAssetIndexOnDisk(assetIndex) {
    if (!assetIndex || !assetIndex.id || !assetIndex.url) return;
    const indexesDir = path.join(paths.gameRoot, 'assets', 'indexes');
    await fs.promises.mkdir(indexesDir, { recursive: true });
    const target = path.join(indexesDir, `${assetIndex.id}.json`);
    if (fs.existsSync(target)) return;
    await httpClient.download(assetIndex.url, target);
  }

  async function buildQuiltSpec({ version, includeShader, shaderSlug, emit }) {
    const effectiveVersion = effectiveModGameVersion(version);
    if (effectiveVersion !== version && emit && emit.status) {
      emit.status({
        text: `Quilt için Minecraft ${effectiveVersion} kullanılıyor (${version} base'i ile aynı dünya/protokol).`,
      });
    }
    if (emit && emit.status) {
      emit.status({ text: `Quilt yükleyici eşleştiriliyor (${effectiveVersion})...` });
    }
    const { merged, loaderVersion } = await quiltInstaller.buildMergedProfile(effectiveVersion);
    const customId = `marsana-quilt-${effectiveVersion}`;
    merged.id = customId;
    const versionDir = path.join(paths.gameRoot, 'versions', customId);
    await fs.promises.mkdir(versionDir, { recursive: true });
    fs.writeFileSync(
      path.join(versionDir, `${customId}.json`),
      JSON.stringify(merged, null, 2),
      'utf8'
    );
    await ensureAssetIndexOnDisk(merged.assetIndex);
    logger.info('Quilt profile ready', { effectiveVersion, loaderVersion, customId });

    if (includeShader) {
      await shaderStackService.installShadersForExternalLoader({
        loader: 'quilt',
        gameRoot: paths.gameRoot,
        gameVersion: effectiveVersion,
        emit,
        shaderSlug,
      });
    }

    const assetIndexId = (merged.assetIndex && merged.assetIndex.id) || effectiveVersion;
    return {
      spec: { number: effectiveVersion, type: 'release', custom: customId },
      overrides: { detached: false, assetIndex: assetIndexId },
      extra: {},
    };
  }

  // Legacy Fabric: 1.3 – 1.13 aralığında Fabric çatalı. Bu sürüm aralığında
  // Iris/Sodium/Continuity yok; sadece loader profilini hazırlıyoruz.
  // effectiveModGameVersion patch yükseltmesi yapılmıyor çünkü eski sürümlerde
  // her patch ayrı bir manifest ve Legacy Fabric tarafından spesifik destekleniyor.
  async function buildLegacyFabricSpec({ version, emit }) {
    if (emit && emit.status) {
      emit.status({ text: `Legacy Fabric yükleyici eşleştiriliyor (${version})...` });
    }
    const { merged, loaderVersion } = await legacyFabricInstaller.buildMergedProfile(version);
    const customId = `marsana-legacy-fabric-${version}`;
    merged.id = customId;
    const versionDir = path.join(paths.gameRoot, 'versions', customId);
    await fs.promises.mkdir(versionDir, { recursive: true });
    fs.writeFileSync(
      path.join(versionDir, `${customId}.json`),
      JSON.stringify(merged, null, 2),
      'utf8'
    );
    await ensureAssetIndexOnDisk(merged.assetIndex);
    logger.info('Legacy Fabric profile ready', { version, loaderVersion, customId });

    const assetIndexId = (merged.assetIndex && merged.assetIndex.id) || version;
    return {
      spec: { number: version, type: 'release', custom: customId },
      overrides: { detached: false, assetIndex: assetIndexId },
      extra: {},
    };
  }

  async function buildNeoForgeSpec({ version, includeShader, includeEmbossed, javaPath, emit }) {
    const effectiveVersion =
      includeShader || includeEmbossed ? effectiveModGameVersion(version) : version;
    if (effectiveVersion !== version && emit && emit.status) {
      emit.status({
        text: `NeoForge mod uyumluluğu için Minecraft ${effectiveVersion} kullanılıyor (${version} base'i ile aynı dünya/protokol).`,
      });
    }
    const { customId, neoforgeVersion } = await neoforgeInstaller.ensureInstalled({
      mcVersion: effectiveVersion,
      gameRoot: paths.gameRoot,
      javaPath,
      emit,
    });
    logger.info('NeoForge profile ready', { effectiveVersion, neoforgeVersion, customId });

    if (includeShader) {
      await shaderStackService.installShadersForExternalLoader({
        loader: 'neoforge',
        gameRoot: paths.gameRoot,
        gameVersion: effectiveVersion,
        emit,
      });
    }

    if (includeEmbossed) {
      await shaderStackService.installEmbossedForExternalLoader({
        loader: 'neoforge',
        gameRoot: paths.gameRoot,
        gameVersion: effectiveVersion,
        emit,
      });
    }

    return {
      spec: { number: effectiveVersion, type: 'release', custom: customId },
      overrides: { detached: false },
      extra: {},
    };
  }

  async function buildLaunchPlan({ version, selectedLoader, modPresets, javaPath, emit }) {
    const loader = selectedLoader || 'vanilla';
    // modPresets.shaderFps / embossedBlocks tüm loader'larda paylaşılan
    // flag'lerdir: Fabric için shaderStackService.ensure içinde işlenir; Forge
    // ailesi için install* dallarına yönlendirilir.
    const includeShader = !!(modPresets && modPresets.shaderFps);
    const includeEmbossed = !!(modPresets && modPresets.embossedBlocks);

    if (loader === 'forge' || loader === 'forge-optifine') {
      applyLoaderModsState('forge');
      return buildForgeSpec({
        version,
        includeOptifine: loader === 'forge-optifine',
        includeShader,
        includeEmbossed,
        javaPath,
        emit,
      });
    }
    if (loader === 'neoforge') {
      // NeoForge yapısı Forge ile aynı (Java installer + custom version profile),
      // dolayısıyla mod izolasyon stratejisi aynı.
      applyLoaderModsState('forge');
      return buildNeoForgeSpec({ version, includeShader, includeEmbossed, javaPath, emit });
    }
    if (loader === 'quilt') {
      // Quilt, Fabric'in çatalı: mod ekosistemi büyük oranda Fabric ile uyumlu,
      // o yüzden mods/ izolasyonu Fabric ile aynı kategoriye düşer.
      applyLoaderModsState('fabric');
      return buildQuiltSpec({ version, includeShader, emit });
    }
    if (loader === 'legacy-fabric') {
      applyLoaderModsState('fabric');
      return buildLegacyFabricSpec({ version, emit });
    }
    if (loader === 'vanilla') {
      applyLoaderModsState('fabric');
      return {
        spec: { number: version, type: 'release' },
        overrides: { detached: false },
        extra: {},
      };
    }
    applyLoaderModsState('fabric');
    return buildFabricSpec({ version, modPresets, emit });
  }

  function resolveJavaPathSyncFallback() {
    const home = (process.env.JAVA_HOME || '').trim();
    if (!home) return undefined;
    const binName = process.platform === 'win32' ? 'java.exe' : 'java';
    const candidate = path.join(home, 'bin', binName);
    if (fs.existsSync(candidate)) return candidate;
    return undefined;
  }

  async function launch(opts, emit) {
    if (!opts || !opts.version) {
      throw new LauncherError(Codes.VERSION_NOT_SELECTED, 'Sürüm seçilmedi.');
    }
    ensureGameRoot();

    const profile = authService.buildLaunchProfile({
      allowOffline: !!opts.offline,
      overrideName: opts.offlineName,
    });

    const memMb = clampMemory(opts.memoryMb);
    const modPresets = opts.modPresets || {
      optifine: false,
      shaderFps: !!opts.shaderStack,
      embossedBlocks: false,
    };

    // Forge installer'ı subprocess olarak çalıştırmak için javaPath'i önceden çöz.
    // Forge için sistem Java'sı (JAVA_HOME) yerine Mojang'ın tam doğru sürümünü
    // kullan — Forge ASM yeni Java bytecode'unu okuyamayabilir (örn. Java 25).
    const loaderForJava = opts.selectedLoader || 'vanilla';
    const strictJava =
      loaderForJava === 'forge' ||
      loaderForJava === 'forge-optifine' ||
      loaderForJava === 'neoforge';
    let javaPath;
    try {
      javaPath = await javaRuntimeService.resolveForLaunch({
        versionId: opts.version,
        versionService,
        emit,
        strict: strictJava,
      });
    } catch (e) {
      if (e && e.code === 'JAVA_RUNTIME_UNAVAILABLE') throw e;
      if (strictJava) throw e;
      logger.warn('Java çözümlemesi başarısız, JAVA_HOME / PATH deneniyor', { err: e.message });
      javaPath = resolveJavaPathSyncFallback();
    }

    const { spec, overrides, extra } = await buildLaunchPlan({
      version: opts.version,
      selectedLoader: opts.selectedLoader,
      modPresets,
      javaPath,
      emit,
    });

    // MCLC çıktısını ayrıca diske yaz; pencere açılmadan crash olduğunda
    // tek inceleyebileceğimiz şey bu log oluyor.
    const launchLogPath = path.join(paths.logsDir, 'mclc-launch.log');
    try {
      fs.mkdirSync(paths.logsDir, { recursive: true });
    } catch {
      /* ignore */
    }
    const launchLogStream = fs.createWriteStream(launchLogPath, { flags: 'w' });
    const writeLog = (label, line) => {
      try {
        launchLogStream.write(`[${label}] ${line}\n`);
      } catch {
        /* ignore */
      }
    };
    writeLog(
      'launcher',
      `Launching version=${opts.version} loader=${opts.selectedLoader || 'vanilla'} javaPath=${javaPath || '(MCLC default)'}`
    );

    const client = new Client();
    client.on('debug', (m) => {
      const s = String(m);
      writeLog('debug', s);
      emit.stdout(s);
    });
    client.on('data', (m) => {
      const s = String(m);
      writeLog('data', s);
      emit.stdout(s);
    });
    client.on('progress', (p) => emit.progress(p));
    client.on('download-status', (s) => {
      writeLog('dl-status', JSON.stringify(s));
      emit.status(s);
    });
    client.on('close', (code) => {
      writeLog('launcher', `Process exited with code ${code}`);
      try {
        launchLogStream.end();
      } catch {
        /* ignore */
      }
      emit.close({ code });
    });

    const extraJvmArgs = isForgeFamily(opts.selectedLoader || 'vanilla') && spec.custom
      ? readForgeFamilyJvmArgs({ gameRoot: paths.gameRoot, customId: spec.custom })
      : [];

    const launchOpts = {
      authorization: profile,
      root: paths.gameRoot,
      version: spec,
      memory: {
        max: `${memMb}M`,
        min: `${Math.min(MIN_MEM_MB, memMb)}M`,
      },
      javaPath,
      customArgs: [...platformJvmArgs(), ...extraJvmArgs],
      overrides,
    };
    void extra;

    logger.info('Launching Minecraft', {
      version: opts.version,
      memMb,
      selectedLoader: opts.selectedLoader || 'vanilla',
      modPresets,
      offline: !!opts.offline,
    });
    // Launcher ayarları (ses) options.txt'e yansıt; Minecraft açılışta okur.
    try {
      applyAudioSettingsToOptionsTxt(opts.audioSettings);
    } catch (e) {
      logger.warn('Ses ayarları options.txt yazımı başarısız', { err: e.message });
    }

    emit.status({ text: 'Oyun başlatılıyor — gerekli dosyalar indiriliyor...' });
    await client.launch(launchOpts);
    return { started: true };
  }

  return { launch };
}

module.exports = { createLaunchService };
