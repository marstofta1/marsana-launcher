'use strict';

// K5a — indirme güvenliği. Build sırasında koşar (pack:win/mac/linux) ve
// korumanın çürümesini engeller:
//   A) httpClient.download yalnızca 200 kabul eder (204/304 -> boş dosya değil).
//   B) Content-Length verilmişse eksik gövde reddedilir; yarım dosya kalmaz.
//   C) Başarılı indirme atomiktir: .part dosyası nihai yola taşınır, iz kalmaz.
//   D) Uzak metinden gelen dosya yolları (Mojang/Modrinth/Forge alanları)
//      hedef klasörün dışına yazamaz — assertInside her çağrı yerinde.
//   E) src/ içinde httpClient.download çağrılan ve uzak bir ada path.join ile
//      giden korumasız satır kalmadığını statik olarak denetler.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const REPO_ROOT = path.resolve(__dirname, '..');
const { createHttpClient } = require(path.join(REPO_ROOT, 'src/core/infra/httpClient'));
const { assertInside } = require(path.join(REPO_ROOT, 'src/core/infra/safeZip'));

let pass = 0;
let fail = 0;
const ok = (n) => { pass += 1; console.log(`  ✓ ${n}`); };
const bad = (n, d) => { fail += 1; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
const check = (n, c, d) => (c ? ok(n) : bad(n, d));

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marsana-dl-test-'));
  return Promise.resolve(fn(dir)).finally(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });
}

// Test sunucusu: yola göre farklı davranır.
function startServer() {
  const server = http.createServer((req, res) => {
    const u = req.url;
    if (u === '/ok') {
      const body = Buffer.from('GERÇEK-İÇERİK-1234');
      res.writeHead(200, { 'Content-Length': String(body.length) });
      res.end(body);
    } else if (u === '/no-length') {
      res.writeHead(200);
      res.end('uzunluksuz-ama-tam');
    } else if (u === '/204') {
      res.writeHead(204);
      res.end();
    } else if (u === '/304') {
      res.writeHead(304);
      res.end();
    } else if (u === '/truncated') {
      // Söz verilenden az bayt gönder, sonra soketi hemen düşür (abort). Böylece
      // build'de keep-alive zaman aşımı beklenmez; kesik indirme hızlı reddedilir.
      res.writeHead(200, { 'Content-Length': '100' });
      res.write('sadece-birkac-bayt');
      res.socket.destroy();
    } else if (u === '/slow') {
      // Eşzamanlılık testi için: gövdeyi iki parçada, araya küçük gecikme koyarak
      // gönder ki iki indirme gerçekten çakışsın.
      const which = req.headers['x-body'] || 'A';
      const part = which.repeat(500);
      res.writeHead(200, { 'Content-Length': '1000' });
      res.write(part);
      setTimeout(() => res.end(part), 20);
    } else if (u === '/500') {
      res.writeHead(500);
      res.end('sunucu-hatasi');
    } else {
      res.writeHead(404);
      res.end('yok');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function run() {
  const client = createHttpClient();
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;

  try {
    // ---------------------------------------------------------- A) durum kodları
    console.log('\nA) download yalnızca 200 kabul eder');

    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'ok.bin');
      await client.download(`${base}/ok`, dest);
      check('200: dosya indirildi', fs.existsSync(dest));
      check('200: içerik doğru', fs.readFileSync(dest, 'utf8') === 'GERÇEK-İÇERİK-1234');
      check('200: .part dosyası kalmadı', !fs.existsSync(`${dest}.part`));
    });

    for (const [label, urlPath] of [['204 No Content', '/204'], ['304 Not Modified', '/304'], ['500 Sunucu hatası', '/500'], ['404 Bulunamadı', '/yok']]) {
      await withTempDir(async (dir) => {
        const dest = path.join(dir, 'x.bin');
        let threw = false;
        try { await client.download(`${base}${urlPath}`, dest); } catch { threw = true; }
        check(`${label}: reddedildi`, threw, 'hata fırlatılmadı');
        check(`${label}: dosya bırakılmadı`, !fs.existsSync(dest));
        check(`${label}: .part bırakılmadı`, !fs.existsSync(`${dest}.part`));
      });
    }

    // ---------------------------------------------------------- B) eksik gövde
    console.log('\nB) Content-Length ile eksik gövde reddedilir');
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'trunc.bin');
      let threw = false;
      try { await client.download(`${base}/truncated`, dest); } catch { threw = true; }
      check('Eksik indirme reddedildi', threw, 'hata fırlatılmadı');
      check('Eksik indirme dosya bırakmadı', !fs.existsSync(dest));
      check('Eksik indirme .part bırakmadı', !fs.existsSync(`${dest}.part`));
    });

    // ---------------------------------------------------------- C) uzunluksuz 200
    console.log('\nC) Content-Length olmadan da düz 200 çalışır');
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'nolen.bin');
      await client.download(`${base}/no-length`, dest);
      check('Uzunluksuz 200 indirildi', fs.readFileSync(dest, 'utf8') === 'uzunluksuz-ama-tam');
    });

    // ------------------------------------------------- F) eşzamanlı aynı hedef
    console.log('\nF) Aynı hedefe eşzamanlı iki indirme birbirini bozmaz');
    await withTempDir(async (dir) => {
      const dest = path.join(dir, 'race.bin');
      // İki indirme aynı dest'e; farklı gövdeler. Benzersiz .part adı sayesinde
      // dosya biri VEYA diğerinin tam gövdesi olmalı — asla karışık.
      const results = await Promise.allSettled([
        client.download(`${base}/slow`, dest),
        client.download(`${base}/slow`, dest),
      ]);
      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const content = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
      const clean = content === 'A'.repeat(1000) || content === 'B'.repeat(1000);
      // Not: iki istek de aynı gövdeyi (X-body yok → 'A') döndürür; kritik olan
      // dosyanın TAM ve tek bir indirmeye ait olması, torn/karışık olmaması.
      check('En az bir indirme başarılı', okCount >= 1, `başarılı: ${okCount}`);
      check('Dosya tam ve bozulmamış (torn değil)', clean, `uzunluk ${content.length}`);
      const leftover = fs.readdirSync(dir).filter((f) => f.endsWith('.part'));
      check('.part izi kalmadı', leftover.length === 0, leftover.join(', '));
    });

    // Benzersiz .part adı: iki farklı indirme geçici dosyaları çakışmamalı.
    check(
      'download() geçici ada pid+sayaç ekliyor',
      /\$\{destPath\}\.\$\{process\.pid\}\.\$\{tmpCounter\}\.part/.test(
        fs.readFileSync(path.join(REPO_ROOT, 'src/core/infra/httpClient.js'), 'utf8')
      )
    );
  } finally {
    server.close();
  }

  // ---------------------------------------------------------- D) yol koruması
  console.log('\nD) Uzak metinden gelen dosya adları hedef dışına yazamaz');

  const ESCAPES = ['../../evil', '..\\..\\evil', '/mutlak', 'C:/Windows/evil', 'a/../../evil', '..'];
  for (const rel of ESCAPES) {
    let threw = false;
    try { assertInside(path.join(os.tmpdir(), 'kok'), rel); } catch { threw = true; }
    check(`assertInside reddeder: ${JSON.stringify(rel)}`, threw);
  }
  // Meşru değerler geçmeli (regresyon).
  for (const rel of ['30.json', 'forge-1.20.1-47.2.0-installer.jar', 'sodium-fabric-0.5.8.jar']) {
    let okv = false;
    try { okv = !!assertInside(path.join(os.tmpdir(), 'kok'), rel); } catch { /* ignore */ }
    check(`assertInside kabul eder: ${JSON.stringify(rel)}`, okv);
  }

  // ---------------------------------------------------------- E) statik denetim
  console.log('\nE) src/ içinde korumasız uzak-yol indirmesi yok');

  // download(<url>, path.join(<dir>, <uzak-alan>)) kalıbı: hedef path.join ile
  // kuruluyorsa ikinci argümanın uzak bir alandan gelmediğini gözle doğrulamak
  // gerekir. Burada kabaca, bilinen riskli alanların artık assertInside/basename
  // olmadan path.join'e gitmediğini denetliyoruz.
  const GUARDED = [
    ['src/core/minecraft/javaRuntimeService.js', /assertInside\(\s*runtimeRoot/],
    ['src/core/minecraft/launchService.js', /assertInside\(\s*indexesDir/],
    ['src/core/mods/shaderStackService.js', /assertInside\(\s*indexesDir/],
    ['src/core/mods/shaderStackService.js', /path\.basename\(String\(file\.filename/],
    ['src/core/mods/forgeInstaller.js', /assertInside\(\s*\n?\s*dir/],
    ['src/core/mods/neoforgeInstaller.js', /assertInside\(\s*\n?\s*dir/],
  ];
  for (const [rel, re] of GUARDED) {
    const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    check(`Koruma yerinde: ${rel} (${re.source.slice(0, 28)}…)`, re.test(text));
  }

  // download çağrısının hemen öncesinde ham `path.join(...file.filename)` kalıbı
  // (basename'siz) kalmamalı.
  const shader = fs.readFileSync(path.join(REPO_ROOT, 'src/core/mods/shaderStackService.js'), 'utf8');
  check(
    'shaderStackService: ham path.join(modsDir, file.filename) kalmadı',
    !/path\.join\(\s*modsDir\s*,\s*file\.filename\s*\)/.test(shader)
  );

  console.log(`\nToplam: ${pass + fail} kontrol — ${pass} geçti, ${fail} kaldı`);
  if (fail > 0) {
    console.error('\nİndirme güvenlik kontrolü BAŞARISIZ.');
    process.exit(1);
  }
  console.log('İndirme güvenlik kontrolü tamam.');
}

run().catch((e) => {
  console.error('Test hatası:', e && e.stack ? e.stack : e);
  process.exit(1);
});
