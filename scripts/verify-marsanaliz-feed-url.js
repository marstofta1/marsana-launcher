'use strict';

// MarsAnaliz güncelleme adresi sabitlemesi (K3'ün ikinci uygulaması).
// MarsAnaliz ayrı bir electron-builder paketi olduğu için kuralın kendi kopyası
// var; bu script iki kopyanın AYNI davrandığını da denetler, böylece biri
// güncellenip diğeri unutulursa build kırılır.

const launcher = require('../src/shared/updateFeedUrl');
const analiz = require('../marsanaliz/src/shared/updateFeedUrl');

const D = analiz.DEFAULT_UPDATES_BASE_URL;
const HOST = 'https://marstofta1.github.io';

let failed = 0;
let total = 0;

function report(ok, name, detail) {
  total += 1;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'HATA'} ${name}`);
  if (detail) console.log(`      ${detail}`);
}

// 1. Bölüm: MarsAnaliz beslemesi için tam eşleşme beklenen senaryolar.
const exactCases = [
  ['Ortam değişkeni yok', undefined, D],
  ['Boş / boşluk', '   ', D],
  ['Doğru adres', D, D],
  ['Sondaki eğik çizgi temizlenir', `${D}/`, D],
  ['İzinli host, farklı yol (staging)', `${HOST}/marsana-launcher/marsanaliz/staging`, `${HOST}/marsana-launcher/marsanaliz/staging`],
  ['Host büyük harfli, küçültülür', 'https://MARSTOFTA1.GITHUB.IO/marsana-launcher/marsanaliz/downloads', D],
  ['Sorgu dizesi atılır', `${D}?token=abc`, D],
  ['Fragment atılır', `${D}#bolum`, D],
  ['Yol normalize edilir', `${HOST}/a/../marsana-launcher/marsanaliz/downloads`, D],
  ['Yabancı host', 'https://kotu.com/downloads', D],
  ['http downgrade', 'http://marstofta1.github.io/marsana-launcher/marsanaliz/downloads', D],
  ['Başka GitHub kullanıcısı', 'https://baskasi.github.io/marsanaliz/downloads', D],
  ['Host son ek hilesi', 'https://marstofta1.github.io.kotu.com/downloads', D],
  ['Kullanıcı bilgisi hilesi (host kotu.com)', 'https://marstofta1.github.io@kotu.com/downloads', D],
  ['İzinli host ama kimlik bilgisi var', 'https://kullanici:jeton@marstofta1.github.io/downloads', D],
  ['İzinli host ama port var', 'https://marstofta1.github.io:8443/downloads', D],
  ['Alt alan adı hilesi', 'https://x.marstofta1.github.io/downloads', D],
  ['Sonda nokta (fail-closed)', 'https://marstofta1.github.io./downloads', D],
  ['Ters eğik çizgi ile yetki kaçırma', 'https:/\\/\\kotu.com/downloads', D],
  ['file:// şeması', 'file:///C:/temp/downloads', D],
  ['URL olmayan metin', 'guncelleme adresi', D],
  ['Sayı gibi bozuk tip', 12345, D],
];

// 2. Bölüm: çıktı metni normalizasyona bağlı olan kirli girdiler. Önemli olan tek
// şey: sonuç HER ZAMAN izinli host'a, https ile, port ve kimlik bilgisi olmadan.
const hostInvariantInputs = [
  'https://marstofta1.github.io\\@kotu.com/downloads',
  'https://marstofta1.github.io\\.kotu.com/downloads',
  'https:\\\\marstofta1.github.io/downloads',
  'https://marstofta1%2egithub%2eio/downloads',
  'https://ｍａｒｓｔｏｆｔａ１.github.io/downloads',
  'https://marstofta1.gith\tub.io/downloads',
  `${D}\r\nHost: kotu.com`,
  `${D}\u0000`,
  '\u200bhttps://kotu.com/downloads',
  'https://kotu.com/downloads#marstofta1.github.io',
  'HTTPS://MARSTOFTA1.GITHUB.IO/marsana-launcher/marsanaliz/downloads',
];

console.log('— MarsAnaliz: tam eşleşme senaryoları —');
for (const [name, input, expected] of exactCases) {
  const actual = analiz.resolveFeedUrl(input);
  report(actual === expected, name, `sonuç: ${actual}${actual === expected ? '' : ` | beklenen: ${expected}`}`);
}

console.log('\n— MarsAnaliz: host değişmezliği —');
for (const input of hostInvariantInputs) {
  const actual = analiz.resolveFeedUrl(input);
  let parsed = null;
  try {
    parsed = new URL(actual);
  } catch {
    parsed = null;
  }
  const ok =
    !!parsed &&
    parsed.protocol === 'https:' &&
    parsed.port === '' &&
    !parsed.username &&
    !parsed.password &&
    analiz.ALLOWED_UPDATE_HOSTS.includes(parsed.hostname);
  report(ok, JSON.stringify(input), `host: ${parsed ? parsed.hostname : '(çözümlenemedi)'}`);
}

// 3. Bölüm: iki kopya ayrışmasın. Varsayılan adresler bilerek farklı (biri
// launcher, biri MarsAnaliz), ama KARAR MANTIĞI birebir aynı olmalı.
console.log('\n— Launcher ve MarsAnaliz kuralları aynı mı —');

report(
  analiz.ALLOWED_UPDATE_HOSTS.join(',') === launcher.ALLOWED_UPDATE_HOSTS.join(','),
  'İzinli host listesi aynı',
  `MarsAnaliz: ${analiz.ALLOWED_UPDATE_HOSTS.join(',')} | Launcher: ${launcher.ALLOWED_UPDATE_HOSTS.join(',')}`
);

report(
  analiz.DEFAULT_UPDATES_BASE_URL.startsWith(`${HOST}/`) &&
    analiz.DEFAULT_UPDATES_BASE_URL !== launcher.DEFAULT_UPDATES_BASE_URL,
  'Varsayılan adres izinli host altında ve launcher’dan ayrı',
  analiz.DEFAULT_UPDATES_BASE_URL
);

const sharedProbes = [
  ...hostInvariantInputs,
  'https://kotu.com/x',
  'http://marstofta1.github.io/x',
  'https://marstofta1.github.io:1/x',
  'https://a@marstofta1.github.io/x',
  'https://marstofta1.github.io/kabul-edilir-yol',
  '',
  '   ',
  undefined,
  null,
  42,
];

let divergences = 0;
for (const probe of sharedProbes) {
  const a = analiz.isAllowedFeedUrl(probe);
  const b = launcher.isAllowedFeedUrl(probe);
  if (a !== b) {
    divergences += 1;
    console.log(`      ayrışma: ${JSON.stringify(probe)} → MarsAnaliz=${a} Launcher=${b}`);
  }
}
report(divergences === 0, `Kabul/ret kararları ${sharedProbes.length} girdide birebir aynı`);

console.log('');
if (failed > 0) {
  console.error(`MarsAnaliz güncelleme adresi doğrulaması başarısız: ${failed}/${total} kontrol hatalı.`);
  process.exit(1);
}
console.log(`MarsAnaliz güncelleme adresi doğrulaması OK (${total}/${total} kontrol).`);
