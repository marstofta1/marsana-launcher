'use strict';

// K4 — arşiv açma güvenliği. Bu script build sırasında koşar (pack:win) ve
// korumanın çürümesini engeller:
//   A) Kötü niyetli zip girdileri hedef klasörün dışına yazamaz (fail-closed).
//   B) Normal arşivler eskisi gibi açılır (UX bozulmadı).
//   C) Gerçek bir .zip dosyasıyla uçtan uca aynı sonuç.
//   D) src/ içinde adm-zip'in korumasız extractAllTo/extractEntryTo çağrısı yok.
//   E) Yüklü adm-zip sürümü yamalı (>= 0.5.2) ve tek kopya.

const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

const { extractZipInside, resolveInside } = require('../src/core/infra/safeZip');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;

function ok(name) {
  pass += 1;
  console.log(`  ✓ ${name}`);
}

function bad(name, detail) {
  fail += 1;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function check(name, condition, detail) {
  if (condition) ok(name);
  else bad(name, detail);
}

// Gerçek zip yazıcısı girdi adını normalize edebildiği için, kötü niyetli adların
// korumamıza BOZULMADAN ulaştığını garanti eden sahte zip nesnesi kullanılır.
function stubZip(entries) {
  return {
    getEntries() {
      return entries.map(([entryName, data]) => ({
        entryName,
        isDirectory: entryName.endsWith('/'),
        getData: () => Buffer.from(data == null ? 'zararli' : data, 'utf8'),
      }));
    },
  };
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-zip-test-'));
  try {
    return fn(dir);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function listFilesRecursive(dir) {
  const out = [];
  const walk = (cur) => {
    let items;
    try {
      items = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const full = path.join(cur, item.name);
      if (item.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------- A) Kaçış denemeleri
console.log('\nA) Kötü niyetli zip girdileri (hedef klasör dışına yazma denemesi)');

const ESCAPE_CASES = [
  ['Klasik ../.. kaçışı', '../../ele-gecirildi.txt'],
  ['Derin kaçış (Windows sistem klasörü)', '../../../../Windows/System32/evil.dll'],
  ['Mutlak sürücü yolu', 'C:/Windows/System32/evil.dll'],
  ['Baştaki eğik çizgi + kaçış', '/../../evil.txt'],
  ['UNC kaçışı', '//sunucu/paylasim/../../../../evil.txt'],
  ['Ters eğik çizgi kaçışı', '..\\..\\evil.txt'],
  ['Ortada .. ile kaçış', 'assets/../../../evil.txt'],
  ['Sadece ..', '..'],
  ['Klasör girdisiyle kaçış', '../../evil-dir/'],
  ['NUL bayt içeren ad', 'normal.txt\u0000/../../evil.txt'],
];

for (const [label, entryName] of ESCAPE_CASES) {
  withTempDir((tmp) => {
    const root = path.join(tmp, 'hedef');
    fs.mkdirSync(root, { recursive: true });
    let threw = false;
    try {
      extractZipInside(stubZip([[entryName, 'zararli']]), root);
    } catch {
      threw = true;
    }
    const leaked = listFilesRecursive(tmp).filter((f) => !f.startsWith(root + path.sep));
    if (!threw) bad(label, 'hata fırlatılmadı');
    else if (leaked.length) bad(label, `dışarı sızan dosya: ${leaked.join(', ')}`);
    else ok(label);
  });
}

// 0.4.16'daki gerçek açık: kök ile aynı harflerle başlayan komşu klasör.
withTempDir((tmp) => {
  const root = path.join(tmp, 'out');
  const sibling = path.join(tmp, 'out2');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  let threw = false;
  try {
    extractZipInside(stubZip([['../out2/evil.txt', 'zararli']]), root);
  } catch {
    threw = true;
  }
  const escaped = fs.existsSync(path.join(sibling, 'evil.txt'));
  check('Komşu klasör ön-ek hilesi (out → out2)', threw && !escaped, escaped ? 'out2 klasörüne yazıldı' : 'hata fırlatılmadı');
});

// ---------------------------------------------------------------- B) Meşru kullanım
console.log('\nB) Normal arşivler (çalışan davranış korunuyor)');

withTempDir((tmp) => {
  const root = path.join(tmp, 'cikti');
  const written = extractZipInside(
    stubZip([
      ['pack.mcmeta', '{"pack":{}}'],
      ['assets/minecraft/textures/block/stone.png', 'PNG'],
      ['assets/klasor/', null],
      ['..foo.txt', 'nokta nokta ile baslayan mesru dosya'],
    ]),
    root
  );
  check('Dosya sayısı doğru', written === 3, `beklenen 3, gelen ${written}`);
  check(
    'İç içe klasör açıldı',
    fs.readFileSync(path.join(root, 'assets/minecraft/textures/block/stone.png'), 'utf8') === 'PNG'
  );
  check('pack.mcmeta açıldı', fs.existsSync(path.join(root, 'pack.mcmeta')));
  check('Boş klasör girdisi oluşturuldu', fs.existsSync(path.join(root, 'assets/klasor')));
  // "..foo" kaçış değildir; yanlışlıkla reddedilirse meşru paketler bozulur.
  check('"..foo.txt" yanlışlıkla reddedilmedi', fs.existsSync(path.join(root, '..foo.txt')));
});

// mrpack akışı: yalnızca overrides/ altı açılır, gerisi yok sayılır.
withTempDir((tmp) => {
  const gameRoot = path.join(tmp, 'oyun');
  const written = extractZipInside(
    stubZip([
      ['modrinth.index.json', '{}'],
      ['overrides/config/ayar.txt', 'ayar'],
      ['overrides/mods/mod.jar', 'JAR'],
      ['baska/dosya.txt', 'alakasiz'],
    ]),
    gameRoot,
    { stripPrefix: 'overrides/' }
  );
  check('overrides/: sadece 2 dosya yazıldı', written === 2, `gelen ${written}`);
  check('overrides/config/ayar.txt yerinde', fs.existsSync(path.join(gameRoot, 'config/ayar.txt')));
  check('overrides dışı dosya yok sayıldı', !fs.existsSync(path.join(gameRoot, 'baska/dosya.txt')));
});

withTempDir((tmp) => {
  const gameRoot = path.join(tmp, 'oyun');
  fs.mkdirSync(gameRoot, { recursive: true });
  let threw = false;
  try {
    extractZipInside(stubZip([['overrides/../../ele-gecirildi.txt', 'zararli']]), gameRoot, {
      stripPrefix: 'overrides/',
    });
  } catch {
    threw = true;
  }
  const leaked = listFilesRecursive(tmp).filter((f) => !f.startsWith(gameRoot + path.sep));
  check('overrides/ içinden kaçış engellendi', threw && leaked.length === 0, leaked.join(', ') || 'hata fırlatılmadı');
});

check('resolveInside boş yol için null döner', resolveInside('C:\\kok', '') === null);
check('resolveInside normal yolu çözer', resolveInside(path.join(os.tmpdir(), 'k'), 'a/b.txt') !== null);
// UNC'ye çevirme hilesi: path.relative baştaki ters eğik çizgileri kırpıp
// "içeride" sonucu üretebiliyordu; kök (sürücü) eşitliği bunu kapatır.
check(
  'resolveInside UNC hilesini reddeder',
  resolveInside('C:\\out', '\\\\C:\\out\\..\\..\\evil.txt') === null,
  String(resolveInside('C:\\out', '\\\\C:\\out\\..\\..\\evil.txt'))
);
check('resolveInside farklı sürücüyü reddeder', resolveInside('C:\\out', 'D:\\evil.txt') === null);

// Baştaki eğik çizgi ZIP'lerde yaygın bir üretici artığı, kaçış değil. Reddedilirse
// meşru kaynak paketleri sessizce yamalanmadan kalır.
withTempDir((tmp) => {
  const root = path.join(tmp, 'cikti');
  const written = extractZipInside(stubZip([['/assets/minecraft/sounds.json', '{}'], ['/pack.mcmeta', '{}']]), root);
  check('Baştaki eğik çizgili girdiler kabul edilir', written === 2, `yazılan ${written}`);
  check('Baştaki eğik çizgi klasör içine düşer', fs.existsSync(path.join(root, 'assets/minecraft/sounds.json')));
});

// Tek geçişli döngüde saldırgan yükünü başa koyup sonuna kaçış girdisi ekleyerek
// "kurulum başarısız" görünürken dosyalarını bırakabilirdi.
withTempDir((tmp) => {
  const root = path.join(tmp, 'cikti');
  let threw = false;
  try {
    extractZipInside(
      stubZip([
        ['mods/yuk.jar', 'zararli-yuk'],
        ['config/yuk.toml', 'zararli-ayar'],
        ['../../ele-gecirildi.txt', 'kacis'],
      ]),
      root
    );
  } catch {
    threw = true;
  }
  const leftBehind = fs.existsSync(root) ? listFilesRecursive(root) : [];
  check(
    'Güvensiz girdi varsa HİÇBİR dosya yazılmaz (önce doğrula, sonra yaz)',
    threw && leftBehind.length === 0,
    leftBehind.join(', ') || 'hata fırlatılmadı'
  );
});

// mrpack akışı kendi mesajını korumalı; kullanıcı "mod paketi" bağlamını görmeli.
withTempDir((tmp) => {
  const root = path.join(tmp, 'oyun');
  let message = '';
  try {
    extractZipInside(stubZip([['overrides/../../evil.txt', 'x']]), root, {
      stripPrefix: 'overrides/',
      unsafeMessage: (rel) => `Mod paketi güvenli değil: "${rel}" oyun klasörünün dışına yazmaya çalışıyor.`,
    });
  } catch (e) {
    message = e.message || '';
  }
  check('mrpack’e özel hata mesajı korunuyor', message.startsWith('Mod paketi güvenli değil:'), message);
});

// Ham fs hataları (EEXIST/ENOENT) LauncherError'a sarılmalı; üst katmanlar onu bekliyor.
withTempDir((tmp) => {
  const root = path.join(tmp, 'cikti');
  let err = null;
  try {
    extractZipInside(stubZip([['dosya', 'ben bir dosyayim'], ['dosya/altta.txt', 'x']]), root);
  } catch (e) {
    err = e;
  }
  check('Dosya/klasör çakışması LauncherError olarak geliyor', !!err && err.name === 'LauncherError', err && err.name);
});

// ---------------------------------------------------------------- C) Gerçek .zip dosyası
console.log('\nC) Diskteki gerçek .zip dosyasıyla uçtan uca');

withTempDir((tmp) => {
  const zipPath = path.join(tmp, 'kaynak-paketi.zip');
  const build = new AdmZip();
  build.addFile('pack.mcmeta', Buffer.from('{"pack":{"description":"test"}}', 'utf8'));
  build.addFile('assets/minecraft/lang/tr_tr.json', Buffer.from('{}', 'utf8'));
  build.writeZip(zipPath);

  const root = path.join(tmp, 'acilan');
  const written = extractZipInside(new AdmZip(zipPath), root);
  check('Gerçek zip açıldı', written === 2, `yazılan ${written}`);
  check(
    'İçerik bozulmadı',
    fs.readFileSync(path.join(root, 'pack.mcmeta'), 'utf8').includes('"description":"test"')
  );

  // shaderStackService yeniden paketleme akışı: aç → değiştir → tekrar zip'le.
  fs.writeFileSync(path.join(root, 'pack.mcmeta'), '{"pack":{"min_format":64,"max_format":64}}', 'utf8');
  const repackPath = path.join(tmp, 'yeniden.zip');
  const repack = new AdmZip();
  repack.addLocalFolder(root);
  repack.writeZip(repackPath);
  const check2 = new AdmZip(repackPath);
  // adm-zip 0.5.x, 0.4.16'dan farklı olarak klasör girdilerini de yazıyor. Bu
  // standart ZIP davranışıdır ve Minecraft kaynak paketlerini etkilemez; anlamlı
  // değişmez, DOSYA listesinin birebir korunmasıdır.
  const repackedFiles = check2
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => e.entryName)
    .sort();
  check(
    'Yeniden paketlemede dosya listesi korunuyor',
    repackedFiles.join('|') === 'assets/minecraft/lang/tr_tr.json|pack.mcmeta',
    repackedFiles.join(', ')
  );
  check(
    'Yeniden paketlenen pack.mcmeta güncel',
    check2.getEntry('pack.mcmeta').getData().toString('utf8').includes('min_format')
  );
});

// ---------------------------------------------------------------- D) Bypass koruması
console.log('\nD) src/ içinde korumasız açma çağrısı yok');

function collectJsFiles(dir) {
  const out = [];
  const walk = (cur) => {
    for (const item of fs.readdirSync(cur, { withFileTypes: true })) {
      if (item.name === 'node_modules') continue;
      const full = path.join(cur, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.name.endsWith('.js')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const unguarded = [];
for (const file of collectJsFiles(path.join(REPO_ROOT, 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, i) => {
    if (/\.(extractAllTo|extractAllToAsync|extractEntryTo)\s*\(/.test(line)) {
      unguarded.push(`${path.relative(REPO_ROOT, file)}:${i + 1}`);
    }
  });
}
check(
  'adm-zip extractAllTo/extractEntryTo doğrudan kullanılmıyor',
  unguarded.length === 0,
  unguarded.length ? `korumasız çağrı: ${unguarded.join(', ')} — extractZipInside kullanın` : ''
);

// ---------------------------------------------------------------- E) Bağımlılık durumu
console.log('\nE) Yüklü adm-zip sürümü');

function parseVer(v) {
  return String(v).split('.').map((n) => parseInt(n, 10) || 0);
}

function gte(a, b) {
  const x = parseVer(a);
  const y = parseVer(b);
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] || 0) > (y[i] || 0)) return true;
    if ((x[i] || 0) < (y[i] || 0)) return false;
  }
  return true;
}

const installedVersion = require('adm-zip/package.json').version;
check(`Yüklü sürüm ${installedVersion} >= 0.5.2 (yamalı)`, gte(installedVersion, '0.5.2'));

// İç içe eski kopya kalmamalı: minecraft-launcher-core ^0.4.13 istiyor, kök
// package.json'daki "overrides" onu da 0.5.x'e çeker. Override düşerse burası yakalar.
const copies = [];
const nmRoot = path.join(REPO_ROOT, 'node_modules');
if (fs.existsSync(nmRoot)) {
  const scan = (dir, depth) => {
    if (depth > 4) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const full = path.join(dir, item.name);
      if (item.name === 'adm-zip') {
        try {
          copies.push(`${path.relative(REPO_ROOT, full)}@${require(path.join(full, 'package.json')).version}`);
        } catch {
          /* ignore */
        }
        continue;
      }
      if (item.name === 'node_modules' || item.name.startsWith('@') || depth < 2) scan(full, depth + 1);
    }
  };
  scan(nmRoot, 0);
}
const oldCopies = copies.filter((c) => !gte(c.split('@').pop(), '0.5.2'));
check(
  `Yamasız iç içe kopya yok (bulunan: ${copies.length})`,
  oldCopies.length === 0,
  oldCopies.join(', ')
);

// ---------------------------------------------------------------- Sonuç
console.log(`\nToplam: ${pass + fail} kontrol — ${pass} geçti, ${fail} kaldı`);
if (fail > 0) {
  console.error('\nArşiv güvenlik kontrolü BAŞARISIZ.');
  process.exit(1);
}
console.log('Arşiv güvenlik kontrolü tamam.');
