#!/usr/bin/env node
// Tek oyunculu "Create (+ eklentiler)" paketini bir Modrinth .mrpack dosyasından üretir.
//
//   node scripts/import-create-pack.js <paket.mrpack>
//
// Yazdığı dosyalar (elle düzenleme, bu betiği yeniden çalıştır):
//   src/shared/createPack.js   — main süreci: tüm jar'lar (url + sha512), sabit/açılıp kapanır, bağımlılıklar
//   src/shared/createAddons.js — arayüz: açılıp kapatılabilen modların listesi
//
// Modrinth'ten yalnız proje adı/kategorisi ve sürüm bağımlılıkları okunur; jar indirilmez.
// Kütüphane / optimizasyon modları ve Create'in kendisi sabittir (kapatılamaz).
// Launcher'la gelen (bundled) eklentiler BUNDLED_TOGGLEABLE ile arayüz listesine eklenir.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT = path.join(__dirname, '..');
const UA = { headers: { 'User-Agent': 'marsana-launcher-dev' } };
const FIXED_SLUGS = new Set(['create', 'azimuth-api']);
const FIXED_CATEGORIES = new Set(['library', 'optimization']);
// shaderStackService CREATE_BUNDLED_ADDONS ile aynı slug'lar.
const BUNDLED_TOGGLEABLE = [{ id: 'create-engines', name: 'Create: Engines' }];

async function getJson(url) {
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function cdnParts(url) {
  // https://cdn.modrinth.com/data/<projectId>/versions/<versionId>/<file>
  const m = /^https:\/\/cdn\.modrinth\.com\/data\/([^/]+)\/versions\/([^/]+)\//.exec(url);
  if (!m) throw new Error('Modrinth CDN adresi değil: ' + url);
  return { projectId: m[1], versionId: m[2] };
}

async function main() {
  const mrpack = process.argv[2];
  if (!mrpack) {
    console.error('Kullanım: node scripts/import-create-pack.js <paket.mrpack>');
    process.exit(1);
  }
  const zip = new AdmZip(mrpack);
  const index = JSON.parse(zip.readAsText('modrinth.index.json'));
  const overrides = zip.getEntries().filter((e) => /^(client-)?overrides\//.test(e.entryName) && !e.isDirectory);
  if (overrides.length) console.warn(`Uyarı: ${overrides.length} override dosyası yok sayıldı.`);

  const files = index.files.filter((f) => f.path.startsWith('mods/') && (!f.env || f.env.client !== 'unsupported'));
  const parts = files.map((f) => cdnParts(f.downloads[0]));
  const projectIds = [...new Set(parts.map((p) => p.projectId))];
  const projects = await getJson('https://api.modrinth.com/v2/projects?ids=' + encodeURIComponent(JSON.stringify(projectIds)));
  const versions = await getJson(
    'https://api.modrinth.com/v2/versions?ids=' + encodeURIComponent(JSON.stringify(parts.map((p) => p.versionId)))
  );
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const slugByProjectId = new Map(projects.map((p) => [p.id, p.slug]));

  const mods = files.map((f, i) => {
    const { projectId, versionId } = parts[i];
    const project = projectById.get(projectId);
    if (!project) throw new Error('Modrinth projesi bulunamadı: ' + projectId);
    const version = versionById.get(versionId);
    const requires = (version ? version.dependencies : [])
      .filter((d) => d.dependency_type === 'required' && slugByProjectId.has(d.project_id))
      .map((d) => slugByProjectId.get(d.project_id))
      .filter((s) => s !== project.slug);
    const fixed = FIXED_SLUGS.has(project.slug) || project.categories.some((c) => FIXED_CATEGORIES.has(c));
    return {
      id: project.slug,
      name: project.title.replace(/[^\p{L}\p{N}\p{P}\p{Zs}+]/gu, '').trim(),
      file: path.posix.basename(f.path),
      url: f.downloads[0],
      sha512: f.hashes.sha512,
      size: f.fileSize,
      fixed,
      requires: [...new Set(requires)].sort(),
    };
  });
  mods.sort((a, b) => a.id.localeCompare(b.id));

  const pack = {
    name: index.name,
    version: index.versionId,
    minecraft: index.dependencies.minecraft,
    neoforge: index.dependencies.neoforge || null,
    mods,
  };
  const header =
    '// OTOMATİK ÜRETİLDİ — elle düzenleme: node scripts/import-create-pack.js <paket.mrpack>\n';

  fs.writeFileSync(
    path.join(ROOT, 'src/shared/createPack.js'),
    header +
      '// Tek oyunculu "Create (+ eklentiler)" paketi (main süreci). Klima SMP paketi bunu kullanmaz.\n' +
      'const CREATE_PACK = Object.freeze(' +
      JSON.stringify(pack, null, 2) +
      ');\n\nmodule.exports = { CREATE_PACK };\n',
    'utf8'
  );

  const toggleable = [
    ...mods.filter((m) => !m.fixed).map((m) => ({ id: m.id, name: m.name })),
    ...BUNDLED_TOGGLEABLE,
  ].sort((a, b) => a.name.replace(/^Create:?\s*/i, '').localeCompare(b.name.replace(/^Create:?\s*/i, ''), 'tr'));
  fs.writeFileSync(
    path.join(ROOT, 'src/shared/createAddons.js'),
    header +
      '// Tek oyunculu "Create (+ eklentiler)" paketinde açılıp kapatılabilen eklentiler (arayüz).\n' +
      '// id\'ler createPack.js + shaderStackService CREATE_BUNDLED_ADDONS ile aynıdır (testte doğrulanır).\n' +
      '// Klima SMP paketi bunu yok sayar: sunucuyla birebir aynı modlar zorunludur.\n' +
      'export const CREATE_ADDONS = Object.freeze(' +
      JSON.stringify(toggleable, null, 2) +
      ');\n\nexport const CREATE_ADDON_IDS = Object.freeze(CREATE_ADDONS.map((a) => a.id));\n',
    'utf8'
  );

  const total = mods.reduce((s, m) => s + m.size, 0);
  console.log(
    `${pack.name} ${pack.version}: ${mods.length} mod (${mods.filter((m) => m.fixed).length} sabit, ` +
      `${toggleable.length} açılıp kapanır), ${(total / 1e6).toFixed(0)} MB, NeoForge ${pack.neoforge}`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
