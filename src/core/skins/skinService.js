'use strict';

// Skin galerisi: hazır (özgün) skinler + kullanıcının kendi PNG'si.
// - Microsoft hesabı: seçilen skin Mojang API ile hesaba yüklenir (sunucularda herkes görür).
// - Çevrimdışı oyun: launcher bir kaynak paketiyle varsayılan Steve/Alex dokularını seçilen
//   skinle değiştirir; mod gerektirmez, her yükleyici ve sürümde çalışır, yalnız oyuncu görür.

const fs = require('fs');
const path = require('path');
const { decodePng, readPngSize } = require('./png');
const { resourcePackFormatForGameVersion } = require('../mods/shaderStackService');

const PRESET_DIR = path.join(__dirname, '..', '..', 'renderer', 'assets', 'skins');
const PRESET_ID_RE = /^[a-z0-9-]{1,32}$/;
const MAX_SKIN_BYTES = 256 * 1024;
const PROFILE_API = 'https://api.minecraftservices.com/minecraft/profile';
const SKINS_API = `${PROFILE_API}/skins`;

const PACK_DIR_NAME = 'marsana-skin';
const PACK_ENTRY = `file/${PACK_DIR_NAME}`;
// 1.19.3+ varsayılan skinler (geniş ve ince kollu); hepsine yazılır ki UUID'ye düşen hangisi olursa olsun değişsin.
const DEFAULT_SKIN_NAMES = ['alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'steve', 'sunny', 'zuri'];

// 1.21 öncesi kaynak paketi biçimleri (1.21+ ve 26.x shaderStackService tablosundan gelir).
const LEGACY_PACK_FORMATS = [
  [[20, 5], 32],
  [[20, 3], 22],
  [[20, 2], 18],
  [[20, 0], 15],
  [[19, 4], 13],
  [[19, 3], 12],
  [[19, 0], 9],
  [[18, 0], 8],
  [[17, 0], 7],
  [[16, 2], 6],
  [[15, 0], 5],
  [[13, 0], 4],
  [[11, 0], 3],
  [[9, 0], 2],
  [[8, 0], 1],
];

function parseClassicVersion(gameVersion) {
  const m = String(gameVersion || '').trim().match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  return { minor: parseInt(m[1], 10), patch: m[2] ? parseInt(m[2], 10) : 0 };
}

/** Sürüm için pack.mcmeta içeriği; skin paketi bu sürümde desteklenmiyorsa null (1.8 öncesi, bilinmeyen). */
function skinPackMeta(gameVersion) {
  const description = 'Marsana Launcher — seçili skin (çevrimdışı)';
  const modern = resourcePackFormatForGameVersion(gameVersion);
  if (modern != null) {
    if (modern >= 65) return { pack: { description, min_format: modern, max_format: modern } };
    return { pack: { description, pack_format: modern } };
  }
  const v = parseClassicVersion(gameVersion);
  if (!v) return null;
  for (const [[minor, patch], format] of LEGACY_PACK_FORMATS) {
    if (v.minor > minor || (v.minor === minor && v.patch >= patch)) {
      return { pack: { description, pack_format: format } };
    }
  }
  return null;
}

/** 64x64 skin'de kolun 4. pikseli (x=54-55) tamamen saydamsa ince kollu (Alex/slim) kalıptır. */
function detectSkinVariant(rgba) {
  for (let y = 20; y < 32; y += 1) {
    for (const x of [54, 55]) {
      if (rgba[(y * 64 + x) * 4 + 3] !== 0) return 'classic';
    }
  }
  return 'slim';
}

function validateSkinBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new Error('Skin dosyası boş.');
  if (buf.length > MAX_SKIN_BYTES) throw new Error('Skin dosyası çok büyük (en fazla 256 KB).');
  const size = readPngSize(buf);
  if (!size) throw new Error('Skin bir PNG dosyası olmalı.');
  if (size.width !== 64 || size.height !== 64) {
    throw new Error(`Skin 64x64 piksel olmalı (bu dosya ${size.width}x${size.height}).`);
  }
  const { rgba } = decodePng(buf);
  return { variant: detectSkinVariant(rgba) };
}

function readOptionsResourcePacks(optionsPath) {
  if (!fs.existsSync(optionsPath)) return { text: '', list: null };
  const text = fs.readFileSync(optionsPath, 'utf8');
  const match = text.match(/^resourcePacks:(.*)$/m);
  if (!match) return { text, list: null };
  try {
    const list = JSON.parse(match[1].trim());
    return { text, list: Array.isArray(list) ? list : null };
  } catch {
    return { text, list: null };
  }
}

function writeOptionsResourcePacks(optionsPath, text, list) {
  const line = `resourcePacks:${JSON.stringify(list)}`;
  let next;
  if (/^resourcePacks:.*$/m.test(text)) next = text.replace(/^resourcePacks:.*$/m, line);
  else next = `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  if (next !== text) fs.writeFileSync(optionsPath, next, 'utf8');
}

function createSkinService({ paths, authService, logger, fetchImpl = globalThis.fetch }) {
  const skinsDir = path.join(paths.userDataDir, 'skins');
  const selectionFile = path.join(skinsDir, 'selection.json');
  const customFile = path.join(skinsDir, 'custom.png');

  function ensureDir() {
    fs.mkdirSync(skinsDir, { recursive: true });
  }

  function listPresetIds() {
    try {
      return fs
        .readdirSync(PRESET_DIR)
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.slice(0, -4))
        .filter((id) => PRESET_ID_RE.test(id));
    } catch {
      return [];
    }
  }

  function presetPath(id) {
    if (!PRESET_ID_RE.test(String(id || ''))) throw new Error('Geçersiz skin.');
    const file = path.join(PRESET_DIR, `${id}.png`);
    if (!fs.existsSync(file)) throw new Error('Bu hazır skin bulunamadı.');
    return file;
  }

  function readSelection() {
    try {
      const raw = JSON.parse(fs.readFileSync(selectionFile, 'utf8'));
      if (raw && raw.kind === 'preset' && PRESET_ID_RE.test(String(raw.presetId || ''))) {
        return { kind: 'preset', presetId: raw.presetId, variant: 'classic' };
      }
      if (raw && raw.kind === 'custom' && fs.existsSync(customFile)) {
        return { kind: 'custom', presetId: null, variant: raw.variant === 'slim' ? 'slim' : 'classic' };
      }
    } catch {
      /* seçim yok */
    }
    return { kind: 'default', presetId: null, variant: 'classic' };
  }

  function writeSelection(selection) {
    ensureDir();
    fs.writeFileSync(selectionFile, JSON.stringify({ ...selection, updatedAt: Date.now() }, null, 2), 'utf8');
  }

  /** Seçili skin'in PNG baytları; varsayılan skin'de null. */
  function selectedSkinBuffer(selection = readSelection()) {
    try {
      if (selection.kind === 'preset') return fs.readFileSync(presetPath(selection.presetId));
      if (selection.kind === 'custom') return fs.readFileSync(customFile);
    } catch (err) {
      logger.warn('Seçili skin okunamadı', { err: err.message });
    }
    return null;
  }

  function publicState() {
    const selection = readSelection();
    let customDataUrl = null;
    if (fs.existsSync(customFile)) {
      try {
        customDataUrl = `data:image/png;base64,${fs.readFileSync(customFile).toString('base64')}`;
      } catch {
        customDataUrl = null;
      }
    }
    const account = authService.current();
    const hasJavaAccount = !!(account && !account.bedrockOnly);
    return { selection, customDataUrl, presets: listPresetIds(), hasJavaAccount };
  }

  async function mojangRequest(method, url, body) {
    const token = await authService.getMinecraftAccessToken();
    if (!token) return { skipped: true };
    await backupCurrentMojangSkin(token);
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (res.ok) return { ok: true };
    let detail = '';
    try {
      const json = await res.json();
      detail = json.errorMessage || json.error || '';
    } catch {
      /* gövde yok */
    }
    if (res.status === 401) throw new Error('Oturum süresi dolmuş; Microsoft ile yeniden giriş yap.');
    if (res.status === 429) throw new Error('Mojang çok sık skin değişikliğine izin vermiyor; birkaç dakika sonra dene.');
    throw new Error(`Mojang skin'i kabul etmedi (HTTP ${res.status}${detail ? `: ${detail}` : ''}).`);
  }

  /**
   * Hesaptaki mevcut skin'i ilk değişiklikten önce "Benim skinim" olarak saklar; aksi halde
   * hazır bir skin seçmek oyuncunun eski skinini geri dönüşsüz silerdi. Kendi PNG'si zaten
   * kayıtlıysa ya da indirilemezse sessizce geçer.
   */
  async function backupCurrentMojangSkin(token) {
    if (fs.existsSync(customFile)) return;
    try {
      const res = await fetchImpl(PROFILE_API, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const profile = await res.json();
      const active = (profile.skins || []).find((s) => s && s.state === 'ACTIVE');
      if (!active || typeof active.url !== 'string') return;
      const url = new URL(active.url.replace(/^http:/, 'https:'));
      if (url.hostname !== 'textures.minecraft.net') return;
      const img = await fetchImpl(url.toString());
      if (!img.ok) return;
      const buf = Buffer.from(await img.arrayBuffer());
      validateSkinBuffer(buf);
      ensureDir();
      fs.writeFileSync(customFile, buf);
    } catch (err) {
      logger.warn('Mevcut skin yedeklenemedi', { err: err.message });
    }
  }

  async function uploadToMojang(buf, variant) {
    const form = new FormData();
    form.append('variant', variant === 'slim' ? 'slim' : 'classic');
    form.append('file', new Blob([buf], { type: 'image/png' }), 'skin.png');
    return mojangRequest('POST', SKINS_API, form);
  }

  async function applyAndReport(selection, buf) {
    writeSelection(selection);
    let uploaded = false;
    let uploadError = null;
    try {
      const outcome = buf
        ? await uploadToMojang(buf, selection.variant)
        : await mojangRequest('DELETE', `${SKINS_API}/active`);
      uploaded = !!(outcome && outcome.ok);
    } catch (err) {
      logger.warn('Skin Mojang hesabına yüklenemedi', { err: err.message });
      uploadError = err.message || String(err);
    }
    // Durum yüklemeden sonra okunur: eski skin'in yedeği (custom.png) o sırada oluşur.
    return { ...publicState(), uploaded, uploadError };
  }

  async function selectPreset(id) {
    const buf = fs.readFileSync(presetPath(id));
    return applyAndReport({ kind: 'preset', presetId: id, variant: 'classic' }, buf);
  }

  async function selectDefault() {
    return applyAndReport({ kind: 'default', presetId: null, variant: 'classic' }, null);
  }

  /** Kullanıcının kaydettiği PNG'yi (custom.png) yeniden seçer. */
  async function selectCustom() {
    if (!fs.existsSync(customFile)) throw new Error('Henüz kendi skinini yüklemedin.');
    const buf = fs.readFileSync(customFile);
    const { variant } = validateSkinBuffer(buf);
    return applyAndReport({ kind: 'custom', presetId: null, variant }, buf);
  }

  async function importCustom(filePath) {
    if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.png')) {
      throw new Error('Skin bir .png dosyası olmalı.');
    }
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_SKIN_BYTES) throw new Error('Skin dosyası çok büyük (en fazla 256 KB).');
    const buf = fs.readFileSync(filePath);
    const { variant } = validateSkinBuffer(buf);
    ensureDir();
    fs.writeFileSync(customFile, buf);
    return applyAndReport({ kind: 'custom', presetId: null, variant }, buf);
  }

  /**
   * Oyun açılmadan hemen önce çağrılır. Çevrimdışı oyunda seçili skin'i kaynak paketiyle
   * etkinleştirir; çevrimiçi (Microsoft) oyunda paketi devre dışı bırakır — orada skin
   * Mojang'dan gelir ve paket diğer oyuncuların varsayılan skinini de değiştirirdi.
   */
  function syncSkinPackForLaunch({ gameDir, gameVersion, offline }) {
    const optionsPath = path.join(gameDir, 'options.txt');
    const packDir = path.join(gameDir, 'resourcepacks', PACK_DIR_NAME);
    const buf = offline ? selectedSkinBuffer() : null;
    const meta = buf ? skinPackMeta(gameVersion) : null;

    const { text, list } = readOptionsResourcePacks(optionsPath);
    if (!buf || !meta) {
      if (list && list.includes(PACK_ENTRY)) {
        writeOptionsResourcePacks(optionsPath, text, list.filter((e) => e !== PACK_ENTRY));
      }
      return { active: false };
    }

    fs.rmSync(packDir, { recursive: true, force: true });
    const textures = path.join(packDir, 'assets', 'minecraft', 'textures', 'entity');
    const targets = [path.join(textures, 'steve.png'), path.join(textures, 'alex.png')];
    for (const kind of ['wide', 'slim']) {
      for (const name of DEFAULT_SKIN_NAMES) targets.push(path.join(textures, 'player', kind, `${name}.png`));
    }
    for (const target of targets) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
    }
    fs.writeFileSync(path.join(packDir, 'pack.mcmeta'), JSON.stringify(meta, null, 2), 'utf8');

    // Skin paketi en üstte olmalı (listenin sonu = en yüksek öncelik).
    const base = (list || ['vanilla']).filter((e) => e !== PACK_ENTRY);
    if (!base.includes('vanilla')) base.unshift('vanilla');
    writeOptionsResourcePacks(optionsPath, text, [...base, PACK_ENTRY]);
    return { active: true };
  }

  return {
    getState: publicState,
    selectPreset,
    selectDefault,
    selectCustom,
    importCustom,
    syncSkinPackForLaunch,
  };
}

module.exports = { createSkinService, skinPackMeta, detectSkinVariant, validateSkinBuffer, PACK_ENTRY };
