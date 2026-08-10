'use strict';

// Günlük sağlık/analiz denetimi (P2). health-monitor.yml bunu her gün koşar.
// Amaç: sistem ve yayın SAYFASI sağlıklı ve GÜNCEL mi — bayat veri veya bozuk
// yayın sessizce kalmasın. Sorun varsa exit 1 -> workflow kırmızı -> issue açılır.
//
// Denetlenenler:
//   1) Canlı site erişilebilir (200) ve GÜNCEL (package.json sürümünü içeriyor).
//   2) En son GitHub release taslak değil ve en az bir kurulum dosyası içeriyor.
//   3) (uyarı) Güncelleme beslemesi (latest.yml) erişilebilir.

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITE = 'https://marstofta1.github.io/marsana-launcher/';
const RELEASES_API = 'https://api.github.com/repos/marstofta1/marsana-launcher/releases/latest';
const FEED = 'https://marstofta1.github.io/marsana-launcher/downloads/latest.yml';

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'marsana-health', ...headers } }, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: b }));
      })
      .on('error', reject);
  });
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
// Canlı sitede GÖRÜNEN etiket `displayVersion`'dır (küçük güncellemede sabit
// kalır, feed sürümü artsa bile). Site denetimi bu görünür etikete bakmalı;
// yoksa her küçük güncelleme sahte "BAYAT" kırmızısı üretir. Normal/isimli
// sürümde version === displayVersion olduğundan iki durumda da doğru çalışır.
const displayVersion = pkg.displayVersion || version;

const problems = [];
const ok = (n) => console.log(`  ✓ ${n}`);
const warn = (n) => console.log(`  ⚠ ${n}`);
const bad = (n) => {
  problems.push(n);
  console.log(`  ✗ ${n}`);
};

(async () => {
  console.log(`Marsana sağlık denetimi — beklenen site etiketi v${displayVersion} (feed v${version})\n`);

  // 1) Canlı site: erişilebilir + güncel.
  // Yeni sürüm push'unda bu denetim deploy-pages ile aynı anda koşabilir; GitHub
  // Pages yayını birkaç dakika gecikebilir. Bayat/erişilemez durumda hemen
  // başarısız sayma — birkaç kez yeniden dene (yayılma penceresi). Gerçekten
  // bayatsa yine de yakalanır.
  console.log('1) Canlı site');
  const SITE_RETRIES = 6;
  const SITE_WAIT_MS = 15000;
  let siteOk = false;
  let lastMsg = '';
  for (let attempt = 1; attempt <= SITE_RETRIES; attempt++) {
    try {
      const r = await fetch(SITE);
      if (r.status === 200 && r.body.includes(`v${displayVersion}`)) {
        ok('Site 200 (erişilebilir)');
        ok(`Site güncel — v${displayVersion} sayfada mevcut`);
        siteOk = true;
        break;
      }
      lastMsg =
        r.status !== 200
          ? `Site ${r.status} döndü (200 bekleniyordu)`
          : `Site BAYAT — v${displayVersion} sayfada yok (changelog/#guncellemeler güncellenmemiş)`;
    } catch (e) {
      lastMsg = `Site erişilemedi: ${e.message}`;
    }
    if (attempt < SITE_RETRIES) {
      console.log(
        `  … deneme ${attempt}/${SITE_RETRIES}: ${lastMsg} — ${SITE_WAIT_MS / 1000}s bekle, yeniden dene (yayın yayılıyor olabilir)`
      );
      await new Promise((res) => setTimeout(res, SITE_WAIT_MS));
    }
  }
  if (!siteOk) bad(lastMsg);

  // 2) En son release. build-desktop.yml bu monitor'le AYNI push'ta paralel
  // koşar; yeni sürümün GitHub release'ini (mac/linux kurulumlarıyla) oluşturması
  // birkaç dakika sürebilir. O pencerede release henüz taslak/dosyasız olabilir ->
  // sahte kırmızı (bkz. koşu #15). Site adımı gibi burada da birkaç kez yeniden
  // dene; gerçekten bozuksa denemeler bitince yine yakalanır.
  console.log('2) GitHub Release');
  const REL_RETRIES = 4;
  const REL_WAIT_MS = 20000;
  let relOk = false;
  let relMsg = '';
  for (let attempt = 1; attempt <= REL_RETRIES; attempt++) {
    try {
      const r = await fetch(RELEASES_API, { Accept: 'application/vnd.github+json' });
      const rel = JSON.parse(r.body || '{}');
      if (r.status !== 200 || !rel.tag_name) {
        relMsg = `Release API ${r.status} (tag okunamadı)`;
      } else if (rel.draft) {
        relMsg = 'Release TASLAK (yayınlanmamış)';
      } else {
        const installers = (rel.assets || []).filter((a) => /\.(exe|dmg|AppImage)$/i.test(a.name));
        if (installers.length) {
          ok(`En son release: ${rel.tag_name}`);
          ok(`${installers.length} kurulum dosyası (${installers.map((a) => a.name.split('.').pop()).join(', ')})`);
          relOk = true;
          break;
        }
        relMsg = "Release'de kurulum dosyası (.exe/.dmg/.AppImage) yok";
      }
    } catch (e) {
      relMsg = `Release kontrolü hata: ${e.message}`;
    }
    if (attempt < REL_RETRIES) {
      console.log(
        `  … deneme ${attempt}/${REL_RETRIES}: ${relMsg} — ${REL_WAIT_MS / 1000}s bekle, yeniden dene (release yayılıyor olabilir)`
      );
      await new Promise((res) => setTimeout(res, REL_WAIT_MS));
    }
  }
  if (!relOk) bad(relMsg);

  // 3) Güncelleme beslemesi (best-effort: yayın henüz yüklenmemiş olabilir)
  console.log('3) Güncelleme beslemesi (latest.yml)');
  try {
    const r = await fetch(FEED);
    if (r.status === 200) ok('latest.yml erişilebilir');
    else warn(`latest.yml ${r.status} (Windows yayını henüz yüklenmemiş olabilir — uyarı)`);
  } catch (e) {
    warn(`latest.yml erişilemedi: ${e.message} (uyarı)`);
  }

  console.log('');
  if (problems.length) {
    console.error(`SAĞLIK DENETİMİ BAŞARISIZ — ${problems.length} sorun:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('Sağlık denetimi TAMAM — site canlı ve güncel, release sağlıklı.');
})().catch((e) => {
  console.error('Beklenmeyen hata:', e && e.stack ? e.stack : e);
  process.exit(1);
});
