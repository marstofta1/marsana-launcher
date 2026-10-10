'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const { assertInside, normalizeEntryName } = require('../infra/safeZip');
const modCompatibilityService = require('./modCompatibilityService');

// Kullanıcının "Mod ekle" alanına bıraktığı modlar. Jar'lar doğrudan mods/ klasörüne değil,
// launcher'ın kendi kütüphanesine kopyalanır; her başlatmada yalnızca seçili yükleyici ve
// Minecraft sürümüyle uyumlu olanlar mods/ klasörüne konur. Böylece Fabric modu Forge'da
// (ya da yanlış sürümde) kalıp oyunu çökertmez, sürüm değişince de silinip kaybolmaz.

const INDEX_FILE = 'index.json';
// mods/ içinde bu servisin koyduğu jar'ları listeler (izolasyon ve temizlik için).
const MODS_DIR_MARKER = '.marsana-user-mods.json';
const STASH_SUFFIXES = ['.marsana-stashed-fabric', '.marsana-stashed-forge', '.marsana-stashed-client-pack'];
const MAX_MOD_BYTES = 512 * 1024 * 1024;
const MAX_NESTED_JARS = 20;
const MAX_PACK_MODS = 500;
// .mrpack biçiminin izin verdiği indirme kaynakları (Modrinth pack spec).
const MRPACK_DOWNLOAD_HOSTS = new Set(['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com']);
// Paketin içine gömülü modlar: overrides/mods/x.jar (alt klasörler önbellektir, alınmaz).
const PACK_EMBEDDED_JAR_RE = /^(?:overrides|client-overrides)\/mods\/[^/]+\.jar$/i;
const INCOMPLETE_DOWNLOAD_RE = /\.(crdownload|part|partial|download|tmp|opdownload)$/i;

// Seçili yükleyicinin kabul ettiği mod türleri.
const LOADER_ACCEPTS = Object.freeze({
  fabric: ['fabric'],
  'fabric-beta': ['fabric'],
  quilt: ['fabric', 'quilt'],
  forge: ['forge'],
  'forge-optifine': ['forge'],
  neoforge: ['neoforge'],
});

const LOADER_LABELS = Object.freeze({
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
  liteloader: 'LiteLoader',
});

// Fabric modlarının hemen hepsinin istediği, launcher'ın zaten sağladığı bağımlılıklar.
const FABRIC_BUILTIN_DEPS = new Set(['minecraft', 'fabricloader', 'fabric-loader', 'java', 'fabric', 'fabric-api', 'quilt_loader', 'quilt_base', 'quilted_fabric_api']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  return { ok: false, message };
}

function loaderLabels(loaders) {
  return (loaders || []).map((l) => LOADER_LABELS[l] || l).join(' / ');
}

/** Dosya hâlâ yazılıyorsa (tarayıcı indirmesi, arşivden çıkarma) boyutu sabitlenene kadar bekle. */
async function waitForStableFile(filePath) {
  let last = -1;
  for (let i = 0; i < 12; i += 1) {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) return stat;
    if (stat.size > 0 && stat.size === last) return stat;
    last = stat.size;
    await sleep(250);
  }
  return fs.promises.stat(filePath);
}

/** Antivirüs taraması / açık indirme tutamacı gibi geçici kilitlerde birkaç kez dene. */
async function readFileWithRetry(filePath) {
  let lastErr = null;
  for (let i = 0; i < 5; i += 1) {
    try {
      return await fs.promises.readFile(filePath);
    } catch (err) {
      lastErr = err;
      if (!err || !['EBUSY', 'EPERM', 'EACCES', 'EAGAIN'].includes(err.code)) break;
      await sleep(400);
    }
  }
  throw lastErr;
}

function safeJsonParse(text) {
  const raw = String(text || '').replace(/^﻿/, '');
  try {
    return JSON.parse(raw);
  } catch {
    /* bazı modlar description içinde ham satır sonu/sekme bırakıyor */
  }
  try {
    return JSON.parse(raw.replace(/[\u0000-\u001F]+/g, ' '));
  } catch {
    return null;
  }
}

function readEntryText(zip, name) {
  try {
    const entry = zip.getEntry(name);
    return entry ? zip.readAsText(entry) : null;
  } catch {
    return null;
  }
}

function tomlString(block, key) {
  const m = String(block || '').match(new RegExp(`^\\s*${key}\\s*=\\s*(?:"([^"\\n]*)"|'([^'\\n]*)')`, 'm'));
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

function manifestVersion(zip) {
  const text = readEntryText(zip, 'META-INF/MANIFEST.MF');
  const m = text && text.match(/^Implementation-Version:\s*(.+)$/m);
  return m ? m[1].trim() : '';
}

/** mods.toml / neoforge.mods.toml: ilk [[mods]] bloğu + minecraft bağımlılık aralığı. */
function parseForgeToml(zip, entryName) {
  const text = readEntryText(zip, entryName) || '';
  const modsBlock = text.split(/^\s*\[\[mods\]\]\s*$/m)[1] || text;
  const firstMod = modsBlock.split(/^\s*\[/m)[0];
  let version = tomlString(firstMod, 'version') || '';
  if (!version || version.includes('${')) version = manifestVersion(zip);
  let mcRange = null;
  for (const dep of text.split(/^\s*\[\[dependencies\.[^\]]+\]\]\s*$/m).slice(1)) {
    const block = dep.split(/^\s*\[/m)[0];
    if (tomlString(block, 'modId') === 'minecraft') {
      mcRange = tomlString(block, 'versionRange');
      break;
    }
  }
  return {
    id: tomlString(firstMod, 'modId') || '',
    name: tomlString(firstMod, 'displayName') || '',
    version,
    mcRange,
  };
}

function fabricDependsList(depends) {
  if (!depends || typeof depends !== 'object') return [];
  return Object.keys(depends).filter((id) => !FABRIC_BUILTIN_DEPS.has(id) && !/^fabric-.*-v\d+$/.test(id));
}

/**
 * Arşivin ne olduğunu belirler. Meta veri okunamasa bile (bozuk JSON vb.) mod reddedilmez;
 * kimlik dosya adından türetilir.
 */
function inspectArchive(zip, fileName) {
  const names = new Set();
  for (const entry of zip.getEntries()) names.add(normalizeEntryName(entry.entryName));
  const has = (n) => names.has(n);
  const hasDir = (prefix) => [...names].some((n) => n.startsWith(prefix));
  const baseName = fileName.replace(/\.(jar|zip)$/i, '');
  const info = { kind: 'unknown', loaders: [], id: '', name: '', version: '', mcDep: null, mcRange: null, depends: [] };

  if (has('fabric.mod.json')) {
    const json = safeJsonParse(readEntryText(zip, 'fabric.mod.json')) || {};
    info.loaders.push('fabric');
    info.id = typeof json.id === 'string' ? json.id : '';
    info.name = typeof json.name === 'string' ? json.name : '';
    info.version = typeof json.version === 'string' ? json.version : '';
    const dep = json.depends && json.depends.minecraft;
    info.mcDep = typeof dep === 'string' || Array.isArray(dep) ? dep : null;
    info.depends = fabricDependsList(json.depends);
  }
  if (has('quilt.mod.json')) {
    const ql = (safeJsonParse(readEntryText(zip, 'quilt.mod.json')) || {}).quilt_loader || {};
    info.loaders.push('quilt');
    info.id = info.id || (typeof ql.id === 'string' ? ql.id : '');
    info.name = info.name || (ql.metadata && typeof ql.metadata.name === 'string' ? ql.metadata.name : '');
    info.version = info.version || (typeof ql.version === 'string' ? ql.version : '');
  }
  if (has('META-INF/neoforge.mods.toml')) {
    const toml = parseForgeToml(zip, 'META-INF/neoforge.mods.toml');
    info.loaders.push('neoforge');
    info.id = info.id || toml.id;
    info.name = info.name || toml.name;
    info.version = info.version || toml.version;
    info.mcRange = toml.mcRange;
  }
  if (has('META-INF/mods.toml')) {
    const toml = parseForgeToml(zip, 'META-INF/mods.toml');
    info.loaders.push('forge');
    info.id = info.id || toml.id;
    info.name = info.name || toml.name;
    info.version = info.version || toml.version;
    info.mcRange = info.mcRange || toml.mcRange;
  }
  if (!info.loaders.length && has('mcmod.info')) {
    const raw = safeJsonParse(readEntryText(zip, 'mcmod.info'));
    const first = Array.isArray(raw) ? raw[0] : raw && Array.isArray(raw.modList) ? raw.modList[0] : raw;
    info.loaders.push('forge');
    if (first && typeof first === 'object') {
      info.id = typeof first.modid === 'string' ? first.modid : '';
      info.name = typeof first.name === 'string' ? first.name : '';
      info.version = typeof first.version === 'string' ? first.version : '';
      // Eski Forge modları tek bir sürüm yazar (örn. "1.12.2").
      if (typeof first.mcversion === 'string' && /^\d+\.\d+(\.\d+)?$/.test(first.mcversion)) {
        info.mcRange = `[${first.mcversion}]`;
      }
    }
  }
  if (!info.loaders.length && has('litemod.json')) {
    const json = safeJsonParse(readEntryText(zip, 'litemod.json')) || {};
    info.loaders.push('liteloader');
    info.name = typeof json.name === 'string' ? json.name : '';
    info.version = typeof json.version === 'string' ? json.version : '';
  }

  if (info.loaders.length) {
    info.kind = 'mod';
    info.name = info.name || baseName;
    info.id = info.id || baseName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    return info;
  }

  if (has('modrinth.index.json') || (has('manifest.json') && hasDir('overrides/'))) {
    // .mrpack / CurseForge modpack: içinde onlarca jar olsa da tek bir mod değildir.
    info.kind = 'modpack';
  } else if (has('plugin.yml') || has('paper-plugin.yml') || has('bungee.yml') || has('velocity-plugin.json')) {
    info.kind = 'plugin';
  } else if (hasDir('shaders/')) {
    info.kind = 'shaderpack';
  } else if (has('pack.mcmeta') && hasDir('assets/')) {
    info.kind = 'resourcepack';
  } else if (has('pack.mcmeta') && hasDir('data/')) {
    info.kind = 'datapack';
  } else if ([...names].some((n) => /\.jar$/i.test(n))) {
    info.kind = 'jar-bundle';
  }
  return info;
}

function versionParts(v) {
  const parts = String(v || '').trim().split('.');
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.map(Number);
}

function compareParts(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Forge/NeoForge Maven sürüm aralığı ("[1.20,1.21)", "[1.20.1]"): 'compatible' | 'incompatible' | 'unknown'. */
function mavenRangeVerdict(range, gameVersion) {
  const game = versionParts(gameVersion);
  const intervals = String(range || '').match(/[[(][^[\]()]*[\])]/g);
  if (!game || !intervals) return 'unknown';
  let sawUnknown = false;
  for (const interval of intervals) {
    const inner = interval.slice(1, -1);
    const bounds = inner.split(',').map((s) => s.trim());
    if (bounds.length === 1) {
      const exact = versionParts(bounds[0]);
      if (!exact) sawUnknown = true;
      else if (exact.every((p, i) => (game[i] || 0) === p)) return 'compatible';
      continue;
    }
    const lower = bounds[0] ? versionParts(bounds[0]) : [];
    const upper = bounds[1] ? versionParts(bounds[1]) : null;
    if (!lower || (bounds[1] && !upper)) {
      sawUnknown = true;
      continue;
    }
    const lowCmp = compareParts(game, lower);
    const lowOk = interval[0] === '[' ? lowCmp >= 0 : lowCmp > 0;
    const upCmp = upper ? compareParts(game, upper) : -1;
    const upOk = !upper || (interval.endsWith(']') ? upCmp <= 0 : upCmp < 0);
    if (lowOk && upOk) return 'compatible';
  }
  return sawUnknown ? 'unknown' : 'incompatible';
}

function packLoaderLabel(id) {
  const key = String(id || '').toLowerCase();
  if (key.startsWith('neoforge')) return 'NeoForge';
  if (key.startsWith('forge')) return 'Forge';
  if (key.startsWith('fabric')) return 'Fabric';
  if (key.startsWith('quilt')) return 'Quilt';
  return '';
}

/** Arşiv bir mod paketiyse özetini döner: hedef sürüm/yükleyici, gömülü jar'lar, indirilecekler. */
function readModpack(zip) {
  const entries = zip.getEntries();
  const embedded = entries.filter((e) => !e.isDirectory && PACK_EMBEDDED_JAR_RE.test(normalizeEntryName(e.entryName)));
  const mrIndex = safeJsonParse(readEntryText(zip, 'modrinth.index.json'));
  if (mrIndex && typeof mrIndex === 'object') {
    const deps = mrIndex.dependencies && typeof mrIndex.dependencies === 'object' ? mrIndex.dependencies : {};
    const loaderKey = Object.keys(deps).find((k) => k !== 'minecraft') || '';
    const downloads = (Array.isArray(mrIndex.files) ? mrIndex.files : []).filter(
      (f) =>
        f &&
        typeof f.path === 'string' &&
        /^mods\/[^/\\]+\.jar$/i.test(f.path) &&
        !(f.env && f.env.client === 'unsupported') &&
        Array.isArray(f.downloads) &&
        typeof f.downloads[0] === 'string'
    );
    return { type: 'mrpack', gameVersion: String(deps.minecraft || ''), loader: packLoaderLabel(loaderKey), embedded, downloads, remoteOnly: 0 };
  }
  const manifest = safeJsonParse(readEntryText(zip, 'manifest.json'));
  if (manifest && typeof manifest === 'object' && (manifest.manifestType === 'minecraftModpack' || entries.some((e) => normalizeEntryName(e.entryName).startsWith('overrides/')))) {
    const mc = manifest.minecraft && typeof manifest.minecraft === 'object' ? manifest.minecraft : {};
    const loaders = Array.isArray(mc.modLoaders) ? mc.modLoaders : [];
    const primary = loaders.find((l) => l && l.primary) || loaders[0] || {};
    return {
      type: 'curseforge',
      gameVersion: String(mc.version || ''),
      loader: packLoaderLabel(primary.id),
      embedded,
      downloads: [],
      // CurseForge paketleri modları yalnızca proje/dosya numarasıyla listeler; jar'lar arşivde yoktur.
      remoteOnly: Array.isArray(manifest.files) ? manifest.files.length : 0,
    };
  }
  return null;
}

function sanitizeJarName(fileName) {
  let name = path.basename(String(fileName || '')).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim();
  name = name.replace(/\.disabled$/i, '').replace(/\.(zip|jar)$/i, '');
  return `${name || 'mod'}.jar`;
}

function createUserModService({ paths, logger, httpClient }) {
  const libraryDir = path.join(paths.userDataDir, 'user-mods');
  const indexPath = path.join(libraryDir, INDEX_FILE);

  function readIndex() {
    try {
      const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const mods = Array.isArray(raw && raw.mods) ? raw.mods : [];
      // Elle silinmiş jar'ları listeden düş.
      return mods.filter((m) => m && typeof m.file === 'string' && fs.existsSync(path.join(libraryDir, path.basename(m.file))));
    } catch {
      return [];
    }
  }

  function writeIndex(mods) {
    fs.mkdirSync(libraryDir, { recursive: true });
    const tmp = `${indexPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ mods }, null, 2), 'utf8');
    fs.renameSync(tmp, indexPath);
  }

  /** Mod bu seçimde yüklenir mi? { active, reason } — reason kullanıcıya gösterilen Türkçe metin. */
  function evaluate(mod, { loader, gameVersion, playMode } = {}) {
    if (mod.enabled === false) return { active: false, reason: 'Kapalı — yüklenmez.' };
    if (playMode === 'client') {
      return { active: false, reason: 'Marsana Client modunda eklenen modlar yüklenmez; Gelişmiş Launcher sekmesini kullanın.' };
    }
    const accepts = LOADER_ACCEPTS[loader];
    if (!accepts) {
      return { active: false, reason: `Seçili yükleyicide mod yüklenmez; ${loaderLabels(mod.loaders)} seçin.` };
    }
    if (!(mod.loaders || []).some((l) => accepts.includes(l))) {
      return { active: false, reason: `Bu mod ${loaderLabels(mod.loaders)} içindir; seçili yükleyicide yüklenmez.` };
    }
    const gv = String(gameVersion || '').trim();
    if (!gv) return { active: true, reason: '' };
    let verdict = 'unknown';
    let wanted = '';
    if (accepts.includes('fabric') && mod.mcDep) {
      verdict = modCompatibilityService.evaluateMcDependency(mod.mcDep, gv);
      wanted = Array.isArray(mod.mcDep) ? mod.mcDep.join(' veya ') : String(mod.mcDep);
    } else if (!accepts.includes('fabric') && mod.mcRange) {
      verdict = mavenRangeVerdict(mod.mcRange, gv);
      wanted = mod.mcRange;
    }
    if (verdict === 'incompatible' || (verdict === 'unknown' && modCompatibilityService.isJarFilenameIncompatibleWithGame(mod.file, gv))) {
      return {
        active: false,
        reason: wanted
          ? `Minecraft ${gv} ile uyumlu değil (mod şunu istiyor: ${wanted}).`
          : `Minecraft ${gv} ile uyumlu değil.`,
      };
    }
    return { active: true, reason: '' };
  }

  function list(selection) {
    return readIndex().map((mod) => ({
      file: mod.file,
      name: mod.name,
      version: mod.version,
      loaders: mod.loaders,
      loaderLabel: loaderLabels(mod.loaders),
      enabled: mod.enabled !== false,
      ...evaluate(mod, selection || {}),
    }));
  }

  function hasActiveMods(selection) {
    return readIndex().some((mod) => evaluate(mod, selection).active);
  }

  function storeMod(buffer, fileName, info) {
    fs.mkdirSync(libraryDir, { recursive: true });
    const jarName = sanitizeJarName(fileName);
    const dest = assertInside(libraryDir, jarName, 'Mod dosya adı güvenli değil.');
    const tmp = `${dest}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, dest);

    const mods = readIndex();
    // Aynı modun (aynı kimlik + aynı yükleyici türü) eski sürümü varsa yerine geçer.
    const sameMod = (m) => m.file === jarName || (m.id === info.id && m.loaders.some((l) => info.loaders.includes(l)));
    const replaced = mods.filter(sameMod);
    for (const old of replaced) {
      if (old.file !== jarName) {
        try {
          fs.unlinkSync(path.join(libraryDir, path.basename(old.file)));
        } catch {
          /* ignore */
        }
      }
    }
    const kept = mods.filter((m) => !sameMod(m));
    kept.push({
      file: jarName,
      id: info.id,
      name: info.name,
      version: info.version,
      loaders: info.loaders,
      mcDep: info.mcDep,
      mcRange: info.mcRange,
      depends: info.depends,
      // Güncellenen mod, kullanıcının açık/kapalı seçimini korur.
      enabled: !replaced.some((m) => m.enabled === false),
      size: buffer.length,
      addedAt: Date.now(),
    });
    writeIndex(kept);

    const missingDeps = info.depends.filter((dep) => !kept.some((m) => m.id === dep));
    const label = `${info.name}${info.version ? ` ${info.version}` : ''} (${loaderLabels(info.loaders)})`;
    return {
      ok: true,
      kind: 'mod',
      file: jarName,
      files: [jarName],
      message: replaced.length ? `${label} güncellendi.` : `${label} eklendi.`,
      warning: missingDeps.length
        ? `Bu mod şu modlara da ihtiyaç duyuyor: ${missingDeps.join(', ')}. Onları da ekleyin, yoksa oyun açılışta uyarı verir.`
        : '',
    };
  }

  function copyPack(buffer, fileName, dirName, okMessage) {
    const dir = path.join(paths.gameRoot, dirName);
    fs.mkdirSync(dir, { recursive: true });
    const safe = path.basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\.jar$/i, '.zip');
    fs.writeFileSync(assertInside(dir, safe, 'Dosya adı güvenli değil.'), buffer);
    return { ok: true, kind: dirName, file: safe, message: okMessage, warning: '' };
  }

  function addBuffer(buffer, fileName, depth) {
    let zip;
    try {
      zip = new AdmZip(buffer);
      zip.getEntries();
    } catch {
      return fail('Dosya bozuk ya da yarım inmiş (geçerli bir .jar arşivi değil). Modu yeniden indirip tekrar deneyin.');
    }
    const info = inspectArchive(zip, fileName);
    if (info.kind === 'mod') return storeMod(buffer, fileName, info);
    if (info.kind === 'resourcepack') {
      return copyPack(buffer, fileName, 'resourcepacks', 'Bu bir kaynak paketi — resourcepacks klasörüne eklendi. Oyunda Seçenekler → Kaynak Paketleri bölümünden açın.');
    }
    if (info.kind === 'shaderpack') {
      return copyPack(buffer, fileName, 'shaderpacks', 'Bu bir shader paketi — shaderpacks klasörüne eklendi. Oyunda Video Ayarları → Shader Packs bölümünden seçin.');
    }
    if (info.kind === 'modpack') {
      return fail('Bu bir mod paketi (modpack), tek bir mod değil; onlarca modu ve ayarı belirli bir sürüm için birlikte getirir. Buraya eklenemez. İçinden istediğiniz modun kendi .jar dosyasını mod sayfasından indirip sürükleyin.');
    }
    if (info.kind === 'plugin') {
      return fail('Bu bir sunucu eklentisi (Bukkit/Spigot/Paper plugin); oyun istemcisine mod olarak eklenemez.');
    }
    if (info.kind === 'datapack') {
      return fail('Bu bir veri paketi (datapack); mod değil. Dünyanızın "datapacks" klasörüne koymanız gerekir.');
    }
    if (info.kind === 'jar-bundle' && depth === 0) {
      // Bazı siteler modu .zip içinde verir: içindeki jar'ları tek tek ekle.
      const results = [];
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory || !/\.jar$/i.test(entry.entryName)) continue;
        if (results.length >= MAX_NESTED_JARS) break;
        const inner = addBuffer(entry.getData(), path.basename(normalizeEntryName(entry.entryName)), 1);
        results.push(inner);
      }
      const added = results.filter((r) => r.ok);
      if (added.length > 0) {
        return {
          ok: true,
          kind: 'mod',
          file: fileName,
          files: added.flatMap((r) => r.files || []),
          message: `Arşivin içinden ${added.length} mod eklendi: ${added.map((r) => r.file).join(', ')}.`,
          warning: added.map((r) => r.warning).filter(Boolean).join(' '),
        };
      }
    }
    return fail('Bu dosyada mod bilgisi bulunamadı (Fabric, Quilt, Forge ya da NeoForge modu değil). Doğru dosyayı indirdiğinizden emin olun: mod sayfasından oyun sürümünüze ve yükleyicinize uygun .jar dosyasını seçin.');
  }

  // Mod paketi: içine gömülü jar'lar + (.mrpack ise) listelenen modlar tek tek kütüphaneye eklenir.
  async function addModpack(pack, fileName) {
    const added = [];
    let failed = 0;
    const take = (buffer, name) => {
      const r = addBuffer(buffer, name, 1);
      if (r.ok && r.kind === 'mod') added.push(r);
      else failed += 1;
    };
    for (const entry of pack.embedded.slice(0, MAX_PACK_MODS)) {
      take(entry.getData(), path.basename(normalizeEntryName(entry.entryName)));
    }
    if (pack.downloads.length > 0 && httpClient) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-pack-'));
      try {
        for (const spec of pack.downloads.slice(0, MAX_PACK_MODS)) {
          try {
            const url = new URL(spec.downloads[0]);
            if (url.protocol !== 'https:' || !MRPACK_DOWNLOAD_HOSTS.has(url.hostname)) throw new Error('izin verilmeyen kaynak');
            const name = path.basename(spec.path);
            const dest = assertInside(tmpDir, name);
            const integrity = {};
            if (spec.hashes && spec.hashes.sha512) integrity.sha512 = spec.hashes.sha512;
            if (spec.hashes && spec.hashes.sha1) integrity.sha1 = spec.hashes.sha1;
            if (Number.isFinite(spec.fileSize)) integrity.size = spec.fileSize;
            await httpClient.download(url.toString(), dest, integrity);
            take(fs.readFileSync(dest), name);
            fs.unlinkSync(dest);
          } catch (err) {
            failed += 1;
            if (logger) logger.warn('Paket modu indirilemedi', { path: spec.path, err: err && err.message });
          }
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    const target = [pack.gameVersion && `Minecraft ${pack.gameVersion}`, pack.loader].filter(Boolean).join(' + ');
    const notes = [];
    if (pack.remoteOnly > 0) {
      notes.push(
        `Bu paket ${pack.remoteOnly} modu yalnızca CurseForge numarasıyla listeliyor; o modlar bu dosyanın içinde değil ve launcher CurseForge'dan indiremiyor. Yani paket bu haliyle eksik: yalnızca dosyanın içine gömülü modlar eklenebildi.`
      );
    }
    if (failed > 0) notes.push(`${failed} dosya eklenemedi ya da indirilemedi.`);
    notes.push('Paketin ayar dosyaları (config, kaynak paketleri vb.) uygulanmadı; yalnızca modlar alındı.');
    if (added.length === 0) {
      return fail(
        `Bu mod paketinden eklenebilecek mod bulunamadı${target ? ` (paket: ${target})` : ''}. ${notes.join(' ')}`
      );
    }
    return {
      ok: true,
      kind: 'mod',
      file: fileName,
      files: added.flatMap((r) => r.files || []),
      message: `Mod paketinden ${added.length} mod eklendi${target ? ` (paket şunun için: ${target})` : ''}.`,
      warning: notes.join(' '),
    };
  }

  async function addFromPath(filePath, selection) {
    const displayName = path.basename(String(filePath || '')) || 'dosya';
    const result = await (async () => {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        return fail('Dosya yolu alınamadı. Dosyayı tarayıcıdan değil, indirdiğiniz klasörden sürükleyin ya da tıklayıp seçin.');
      }
      if (INCOMPLETE_DOWNLOAD_RE.test(filePath)) {
        return fail('İndirme henüz tamamlanmamış. İndirme bitince .jar dosyasını sürükleyin.');
      }
      let stat;
      try {
        stat = await waitForStableFile(filePath);
      } catch {
        return fail('Dosya bulunamadı. Taşınmış ya da silinmiş olabilir; dosyayı klasörden yeniden sürükleyin.');
      }
      if (stat.isDirectory()) return fail('Klasör eklenemez; klasörün içindeki .jar dosyalarını sürükleyin.');
      if (stat.size === 0) return fail('Dosya boş (0 bayt). İndirme yarım kalmış; modu yeniden indirin.');
      if (stat.size > MAX_MOD_BYTES) return fail('Dosya çok büyük (512 MB üstü); bir mod dosyası olamaz.');
      const cleanName = displayName.replace(/\.disabled$/i, '');
      if (!/\.(jar|zip|mrpack)$/i.test(cleanName)) {
        return fail(`Yalnızca .jar mod dosyaları eklenebilir (bu dosya: ${path.extname(cleanName) || 'uzantısız'}).`);
      }
      let buffer;
      try {
        buffer = await readFileWithRetry(filePath);
      } catch (err) {
        return fail(`Dosya okunamadı (${(err && err.code) || 'bilinmeyen hata'}). Başka bir program kullanıyor olabilir; birkaç saniye sonra tekrar deneyin.`);
      }
      try {
        let pack = null;
        try {
          pack = readModpack(new AdmZip(buffer));
        } catch {
          pack = null; // bozuk arşiv: addBuffer anlaşılır mesajı üretir
        }
        if (pack) return await addModpack(pack, cleanName);
        return addBuffer(buffer, cleanName, 0);
      } catch (err) {
        if (logger) logger.warn('Mod eklenemedi', { file: displayName, err: err && err.message });
        return fail(`Mod kaydedilemedi (${(err && (err.code || err.message)) || 'bilinmeyen hata'}).`);
      }
    })();
    // "Eklendi" yazıp oyunda görünmemesi yanıltıcı: şu anki seçimde yüklenmeyecekse hemen söyle.
    if (result.ok && result.kind === 'mod' && selection) {
      const index = readIndex();
      const blocked = (result.files || [])
        .map((file) => index.find((m) => m.file === file))
        .filter(Boolean)
        .map((mod) => ({ mod, verdict: evaluate(mod, selection) }))
        .filter((x) => !x.verdict.active);
      if (blocked.length > 3) {
        // Mod paketi: yüzlerce satır yerine özet.
        result.notLoading = `${blocked.length} mod şu anki seçimde yüklenmeyecek. Örnek — ${blocked[0].mod.name}: ${blocked[0].verdict.reason}`;
      } else if (blocked.length > 0) {
        result.notLoading = blocked
          .map((x) => `${x.mod.name}: ${x.verdict.reason}`)
          .join(' ');
      }
    }
    return { name: displayName, ...result };
  }

  async function addFromPaths(filePaths, selection) {
    const out = [];
    for (const filePath of Array.isArray(filePaths) ? filePaths.slice(0, 50) : []) {
      out.push(await addFromPath(filePath, selection));
    }
    return out;
  }

  function remove(file) {
    const name = path.basename(String(file || ''));
    const mods = readIndex();
    if (!mods.some((m) => m.file === name)) return false;
    try {
      fs.unlinkSync(path.join(libraryDir, name));
    } catch {
      /* ignore */
    }
    writeIndex(mods.filter((m) => m.file !== name));
    return true;
  }

  function setEnabled(file, enabled) {
    const name = path.basename(String(file || ''));
    const mods = readIndex();
    const mod = mods.find((m) => m.file === name);
    if (!mod) return false;
    mod.enabled = !!enabled;
    writeIndex(mods);
    return true;
  }

  /** Toplu işlem: 'removeAll' | 'disableAll' | 'enableAll'. Etkilenen mod sayısını döner. */
  function bulk(action) {
    const mods = readIndex();
    if (action === 'removeAll') {
      for (const mod of mods) {
        try {
          fs.unlinkSync(path.join(libraryDir, path.basename(mod.file)));
        } catch {
          /* ignore */
        }
      }
      writeIndex([]);
      return mods.length;
    }
    if (action !== 'disableAll' && action !== 'enableAll') return 0;
    const enabled = action === 'enableAll';
    const changed = mods.filter((m) => (m.enabled !== false) !== enabled);
    for (const mod of changed) mod.enabled = enabled;
    if (changed.length > 0) writeIndex(mods);
    return changed.length;
  }

  function readPlaced(modsDir) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(modsDir, MODS_DIR_MARKER), 'utf8'));
      return Array.isArray(raw && raw.jars) ? raw.jars.map((j) => path.basename(String(j))) : [];
    } catch {
      return [];
    }
  }

  function removePlaced(modsDir, name, { keepActive = false } = {}) {
    for (const candidate of [keepActive ? null : name, ...STASH_SUFFIXES.map((s) => name + s)]) {
      if (!candidate) continue;
      try {
        fs.unlinkSync(path.join(modsDir, candidate));
      } catch {
        /* yok ya da kilitli */
      }
    }
  }

  /**
   * mods/ klasörünü seçime göre eşitler: uyumlu modlar kopyalanır, bu servisin daha önce koyduğu
   * ama artık uymayanlar kaldırılır. Yükleyici stash'i ve uyumluluk temizliği BİTTİKTEN sonra çağrılmalı.
   */
  function syncToModsDir({ modsDir, loader, gameVersion, playMode }) {
    const mods = readIndex();
    const previous = readPlaced(modsDir);
    if (mods.length === 0 && previous.length === 0) return { installed: [], skipped: [] };

    const selection = { loader, gameVersion, playMode };
    const installed = [];
    const skipped = [];
    fs.mkdirSync(modsDir, { recursive: true });
    for (const mod of mods) {
      const verdict = evaluate(mod, selection);
      if (!verdict.active) {
        // Kullanıcının kendi kapattığı mod "atlandı" diye raporlanmaz.
        if (mod.enabled !== false) skipped.push({ name: mod.name, reason: verdict.reason });
        continue;
      }
      const src = path.join(libraryDir, mod.file);
      const dest = path.join(modsDir, mod.file);
      try {
        let upToDate = false;
        try {
          upToDate = fs.statSync(dest).size === fs.statSync(src).size;
        } catch {
          upToDate = false;
        }
        if (!upToDate) fs.copyFileSync(src, dest);
        removePlaced(modsDir, mod.file, { keepActive: true });
        installed.push(mod.file);
      } catch (err) {
        skipped.push({ name: mod.name, reason: `mods klasörüne kopyalanamadı (${(err && err.code) || 'hata'}).` });
      }
    }
    for (const name of previous) {
      if (!installed.includes(name)) removePlaced(modsDir, name);
    }
    const markerPath = path.join(modsDir, MODS_DIR_MARKER);
    if (installed.length > 0) {
      fs.writeFileSync(markerPath, JSON.stringify({ jars: installed }, null, 2), 'utf8');
    } else {
      try {
        fs.unlinkSync(markerPath);
      } catch {
        /* ignore */
      }
    }
    return { installed, skipped };
  }

  return { addFromPaths, list, remove, setEnabled, bulk, hasActiveMods, syncToModsDir };
}

module.exports = {
  createUserModService,
  MODS_DIR_MARKER,
  // Test edilebilirlik için saf yardımcılar.
  inspectArchive,
  readModpack,
  mavenRangeVerdict,
  sanitizeJarName,
};
