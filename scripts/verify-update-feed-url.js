'use strict';

const {
  DEFAULT_UPDATES_BASE_URL,
  ALLOWED_UPDATE_HOSTS,
  resolveFeedUrl,
} = require('../src/shared/updateFeedUrl');

const D = DEFAULT_UPDATES_BASE_URL;
const HOST = 'https://marstofta1.github.io';

// 1. Bölüm: tam eşleşme beklenen senaryolar.
const exactCases = [
  ['Ortam değişkeni yok', undefined, D],
  ['Boş / boşluk', '   ', D],
  ['Doğru adres', D, D],
  ['Sondaki eğik çizgi temizlenir', `${D}/`, D],
  ['Sondaki çoklu eğik çizgi temizlenir', `${D}///`, D],
  ['İzinli host, farklı yol (staging)', `${HOST}/marsana-launcher/staging`, `${HOST}/marsana-launcher/staging`],
  ['Host büyük harfli, küçültülür', 'https://MARSTOFTA1.GITHUB.IO/marsana-launcher/downloads', D],
  ['Sorgu dizesi atılır', `${D}?token=abc`, D],
  ['Fragment atılır', `${D}#bolum`, D],
  ['Yol normalize edilir', `${HOST}/a/b/../../marsana-launcher/downloads`, D],
  ['Yabancı host', 'https://kotu.com/downloads', D],
  ['http downgrade', 'http://marstofta1.github.io/marsana-launcher/downloads', D],
  ['Başka GitHub kullanıcısı', 'https://baskasi.github.io/marsana-launcher/downloads', D],
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

// 2. Bölüm: çıktının tam metni normalizasyona bağlı olan kirli girdiler.
// Güvenlik açısından önemli olan tek şey: sonuç HER ZAMAN izinli host'a,
// https ile, port ve kimlik bilgisi olmadan gitmeli.
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
  'HTTPS://MARSTOFTA1.GITHUB.IO/downloads',
];

let failed = 0;

console.log('— Tam eşleşme senaryoları —');
for (const [name, input, expected] of exactCases) {
  const actual = resolveFeedUrl(input);
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'HATA'} ${name}`);
  console.log(`      girdi   : ${input === undefined ? '(yok)' : JSON.stringify(input)}`);
  console.log(`      sonuç   : ${actual}`);
  if (!ok) console.log(`      beklenen: ${expected}`);
}

console.log('');
console.log('— Host değişmezliği senaryoları —');
for (const input of hostInvariantInputs) {
  const actual = resolveFeedUrl(input);
  let parsed = null;
  try {
    parsed = new URL(actual);
  } catch (err) {
    parsed = null;
  }
  const ok =
    !!parsed &&
    parsed.protocol === 'https:' &&
    parsed.port === '' &&
    !parsed.username &&
    !parsed.password &&
    ALLOWED_UPDATE_HOSTS.includes(parsed.hostname);
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'HATA'} ${JSON.stringify(input)}`);
  console.log(`      sonuç   : ${actual}`);
  console.log(`      host    : ${parsed ? parsed.hostname : '(çözümlenemedi)'}`);
}

const total = exactCases.length + hostInvariantInputs.length;
console.log('');
if (failed > 0) {
  console.error(`Güncelleme adresi doğrulaması başarısız: ${failed}/${total} senaryo hatalı.`);
  process.exit(1);
}
console.log(`Güncelleme adresi doğrulaması OK (${total}/${total} senaryo).`);
