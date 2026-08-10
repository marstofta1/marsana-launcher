'use strict';

// O1 — launcher birim testleri (node'un yerleşik test runner'ı: `node --test`).
// Güvenlik-kritik saf fonksiyonları kapsar. `npm test` bunları + build-gate
// verify suite'ini çalıştırır. Yeni güvenlik kodu bu testleri kırmadan geçmeli.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const feed = require('../src/shared/updateFeedUrl');
const safeZip = require('../src/core/infra/safeZip');
const { createModrinthClient } = require('../src/core/mods/modrinthClient');
const shader = require('../src/core/mods/shaderStackService');
const vsel = require('../src/core/mods/modrinthVersionSelect');
const { computeAudioOptionUpdates } = require('../src/core/minecraft/audioOptions');

// ---------------------------------------------------------------- updateFeedUrl
test('updateFeedUrl: izinli host + https kabul edilir', () => {
  assert.strictEqual(
    feed.isAllowedFeedUrl('https://marstofta1.github.io/marsana-launcher/downloads'),
    true
  );
});

test('updateFeedUrl: farklı host, http, port, userinfo reddedilir', () => {
  assert.strictEqual(feed.isAllowedFeedUrl('https://evil.example.com/x'), false);
  assert.strictEqual(feed.isAllowedFeedUrl('http://marstofta1.github.io/x'), false);
  assert.strictEqual(feed.isAllowedFeedUrl('https://marstofta1.github.io:8443/x'), false);
  assert.strictEqual(feed.isAllowedFeedUrl('https://user@marstofta1.github.io/x'), false);
});

test('updateFeedUrl: resolveFeedUrl boş/geçersizde sabit varsayılana döner (fail-closed)', () => {
  assert.strictEqual(feed.resolveFeedUrl(''), feed.DEFAULT_UPDATES_BASE_URL);
  assert.strictEqual(feed.resolveFeedUrl('https://evil.com/x'), feed.DEFAULT_UPDATES_BASE_URL);
  assert.strictEqual(
    feed.resolveFeedUrl('https://marstofta1.github.io/ozel/yol'),
    'https://marstofta1.github.io/ozel/yol'
  );
});

// ---------------------------------------------------------------------- safeZip
test('safeZip: klasör dışına kaçışlar HER platformda reddedilir', () => {
  const root = path.resolve('kok');
  for (const bad of ['../../evil', '..\\..\\evil', '/mutlak', 'C:/Windows/evil', 'C:\\Windows\\evil', '..']) {
    assert.strictEqual(safeZip.resolveInside(root, bad), null, `reddetmeli: ${bad}`);
  }
});

test('safeZip: meşru adlar kabul edilir', () => {
  const root = path.resolve('kok');
  for (const good of ['30.json', 'mods/sodium.jar', '..foo.txt']) {
    assert.ok(safeZip.resolveInside(root, good), `kabul etmeli: ${good}`);
  }
});

test('safeZip: normalizeEntryName baştaki slash ve ters bölüyü düzeltir', () => {
  assert.strictEqual(safeZip.normalizeEntryName('/assets/x.png'), 'assets/x.png');
  assert.strictEqual(safeZip.normalizeEntryName('assets\\x.png'), 'assets/x.png');
});

// ---------------------------------------------------------------- modrinthClient
test('modrinthClient.fileIntegrity: hash + boyut çıkarır, eksikte boş döner', () => {
  const mc = createModrinthClient({ httpClient: {} });
  assert.deepStrictEqual(
    mc.fileIntegrity({ hashes: { sha512: 'aa', sha1: 'bb' }, size: 5 }),
    { sha512: 'aa', sha1: 'bb', size: 5 }
  );
  assert.deepStrictEqual(mc.fileIntegrity({}), {});
  assert.deepStrictEqual(mc.fileIntegrity(null), {});
});

// -------------------------------------------------- shaderStackService (O1/O4)
// Kritik Modrinth sürüm-eşleştirme mantığı — yanlış eşleşme mod/shader kurulumunu
// bozar (26.1.2 vs 26.1.1 -> dünya yüklenirken crash). Saf yardımcıları kapsar.
test('shader.resolveShaderSlug: bilinmeyen slug -> default', () => {
  assert.strictEqual(shader.resolveShaderSlug('boyle-bir-slug-yok'), 'complementary-reimagined');
  assert.strictEqual(shader.resolveShaderSlug(null), 'complementary-reimagined');
});

test('shader.extractMcVersionFromModMeta: mc etiketini çıkarır', () => {
  assert.strictEqual(shader.extractMcVersionFromModMeta({ files: [{ filename: 'sodium-mc1.21.1-0.5.jar' }] }), '1.21.1');
  assert.strictEqual(shader.extractMcVersionFromModMeta({ name: 'Sodium mc26.1' }), '26.1');
  assert.strictEqual(shader.extractMcVersionFromModMeta({}), null);
  assert.strictEqual(shader.extractMcVersionFromModMeta(null), null);
});

test('shader.modrinthLoaderModGameVersionCandidates: 26.x patch minor de ekler', () => {
  assert.deepStrictEqual(shader.modrinthLoaderModGameVersionCandidates('26.1.2'), ['26.1.2', '26.1']);
  assert.deepStrictEqual(shader.modrinthLoaderModGameVersionCandidates('1.21'), ['1.21', '1.21.1']);
});

test('shader.modrinthGameVersionCandidates: 26.1.x classic fallback ekler', () => {
  const c = shader.modrinthGameVersionCandidates('26.1.2');
  assert.ok(c.includes('26.1.2') && c.includes('26.1') && c.includes('1.21.11'), JSON.stringify(c));
});

test('shader.versionListsAnyGame + modrinthCandidateRank', () => {
  assert.strictEqual(shader.versionListsAnyGame({ game_versions: ['26.1.2', '1.21'] }, ['26.1', '26.1.2']), true);
  assert.strictEqual(shader.versionListsAnyGame({ game_versions: ['1.20'] }, ['26.1.2']), false);
  assert.strictEqual(shader.modrinthCandidateRank({ game_versions: ['26.1'] }, ['26.1.2', '26.1']), 1);
  assert.strictEqual(shader.modrinthCandidateRank({ game_versions: ['x'] }, ['26.1.2']), Infinity);
});

test('shader.pickNewestModrinthVersion: tam patch eşleşmesi (rank 0) kazanır', () => {
  const versions = [
    { id: 'a', game_versions: ['26.1'], version_type: 'release', date_published: '2026-02-01' },
    { id: 'b', game_versions: ['26.1.2'], version_type: 'release', date_published: '2026-01-01' },
  ];
  const picked = shader.pickNewestModrinthVersion(versions, { gameVersion: '26.1.2', anchorTs: Date.parse('2026-03-01') });
  assert.strictEqual(picked && picked.id, 'b'); // 26.1.2 tam eşleşme, daha eski olsa da rank kazanır
  assert.strictEqual(shader.pickNewestModrinthVersion([], { gameVersion: '26.1.2' }), null);
});

test('shader.glowingOresVariantLabel', () => {
  assert.strictEqual(shader.glowingOresVariantLabel({ name: 'Glowing Ores Border' }), 'border');
  assert.strictEqual(shader.glowingOresVariantLabel({ name: 'Default Pack' }), 'default');
  assert.strictEqual(shader.glowingOresVariantLabel({ name: 'plain' }), 'unknown');
});

// OptiFine reconcile — her slug'in bir jar-test'i olmali, aksi halde reconcile
// bundled jar'i silip yeniden indiremeyip crash'e yol acar. Yapisal degismezlik:
// slug listesi ve jar-test anahtarlari birebir ayni kume olmali.
test('shader OptiFine reconcile: slug listesi ile jar-test anahtarlari birebir eslesir', () => {
  const slugs = [...shader.OPTIFINE_RECONCILE_SLUGS];
  const keys = Object.keys(shader.OPTIFINE_RECONCILE_JAR_TESTS);
  assert.deepStrictEqual(new Set(slugs), new Set(keys), 'her slug bir jar-test anahtarina sahip olmali');
  for (const slug of slugs) {
    assert.ok(shader.OPTIFINE_RECONCILE_JAR_TESTS[slug] instanceof RegExp, `${slug} icin regex yok`);
  }
});

// Regresyon: reconcile slug'lari gercek Modrinth proje slug'lari olmali. Onceki
// hatali 'forgeconfigapiport' (rrls bagimliligi -> crash) ve 'ferritecore'
// (perf modu sessizce kaybolur) slug'lari 404 veriyordu. Bilinen-gecersiz
// slug'lar tabloya geri sizmamali.
test('shader OptiFine reconcile: bilinen-gecersiz (404) slug\'lar kullanilmaz', () => {
  const invalid = ['forgeconfigapiport', 'ferritecore'];
  for (const bad of invalid) {
    assert.ok(
      !shader.OPTIFINE_RECONCILE_SLUGS.includes(bad),
      `gecersiz (404) slug tabloda olmamali: ${bad}`
    );
  }
  assert.ok(shader.OPTIFINE_RECONCILE_SLUGS.includes('forge-config-api-port'), 'forge-config-api-port bulunmali');
  assert.ok(shader.OPTIFINE_RECONCILE_SLUGS.includes('ferrite-core'), 'ferrite-core bulunmali');
});

// jar-test'ler INDIRILEN dosya adini yakalamali (slug'la dosya adi farkli olabilir).
test('shader OptiFine reconcile: jar-test\'ler gercek dosya adlarini yakalar', () => {
  const fcap = shader.OPTIFINE_RECONCILE_JAR_TESTS['forge-config-api-port'];
  assert.ok(fcap.test('ForgeConfigAPIPort-v21.9.8+mc1.21.9-Fabric.jar'), 'fcap dosya adini yakalamali');
  assert.ok(!fcap.test('rrls-5.1.11+mc1.21.9-fabric.jar'), 'fcap testi rrls\'i yakalamamali');
  const ferrite = shader.OPTIFINE_RECONCILE_JAR_TESTS['ferrite-core'];
  assert.ok(ferrite.test('ferritecore-8.1.0-fabric.jar'), 'ferrite dosya adini yakalamali');
});

// ------------------------------------------------- audioOptions (ses kaliciligi)
// Launcher, oyun-ici ses degisikliklerini EZMEMELI. Muzigi oyun icinde kapatinca
// bir sonraki acilista geri acilma hatasinin cozumu bu saf karar fonksiyonunda.
test('audio: yeni kurulum — anahtar yoksa launcher degeri tohumlanir', () => {
  const { updates, nextLastApplied } = computeAudioOptionUpdates({
    audio: { masterVolume: 1.0, musicVolume: 0.5 },
    currentOptionsText: '',
    lastApplied: {},
  });
  assert.strictEqual(updates.soundCategory_master, '1.000');
  assert.strictEqual(updates.soundCategory_music, '0.500');
  assert.strictEqual(nextLastApplied.soundCategory_music, '0.500');
});

test('audio: oyun-ici kapatma korunur — slider oynatilmadiysa yazilmaz (lastApplied var)', () => {
  const { updates, nextLastApplied } = computeAudioOptionUpdates({
    audio: { musicVolume: 0.5 },                       // launcher hala %50
    currentOptionsText: 'soundCategory_music:0.0\n',   // kullanici oyun icinde kapatti
    lastApplied: { soundCategory_music: '0.500' },     // launcher son kez %50 uygulamis
  });
  assert.strictEqual(updates.soundCategory_music, undefined, 'muzik yazilmamali (0 kalmali)');
  assert.deepStrictEqual(Object.keys(updates), []);
  assert.strictEqual(nextLastApplied.soundCategory_music, '0.500');
});

test('audio: ilk duzeltilmis acilis — anahtar var ama lastApplied yok -> yazilmaz', () => {
  const { updates } = computeAudioOptionUpdates({
    audio: { musicVolume: 0.5 },
    currentOptionsText: 'soundCategory_music:0.0\n',
    lastApplied: {},
  });
  assert.strictEqual(updates.soundCategory_music, undefined, 'mevcut oyun-ici deger korunmali');
});

test('audio: launcher override — slider oynatildi (desired != lastApplied) -> yazilir', () => {
  const { updates, nextLastApplied } = computeAudioOptionUpdates({
    audio: { musicVolume: 0.2 },                       // kullanici launcher slider'ini %20 yapti
    currentOptionsText: 'soundCategory_music:0.8\n',
    lastApplied: { soundCategory_music: '0.500' },
  });
  assert.strictEqual(updates.soundCategory_music, '0.200', 'launcher override yazilmali');
  assert.strictEqual(nextLastApplied.soundCategory_music, '0.200');
});

test('audio: null/gecersiz audio -> guncelleme yok', () => {
  assert.deepStrictEqual(computeAudioOptionUpdates({ audio: null }).updates, {});
  assert.deepStrictEqual(
    computeAudioOptionUpdates({ audio: { musicVolume: 'x' }, currentOptionsText: '', lastApplied: {} }).updates,
    {}
  );
});

// ----------------------------------------------- modrinthVersionSelect (O4)
// Sürüm-seçim mantığı shaderStackService'ten ayrı modüle çıkarıldı. Bu bloğun iki
// işi var: (1) modülü doğrudan test etmek, (2) shaderStackService'in AYNI fonksiyonu
// yeniden dışa aktardığını (re-export bağlantısının doğru olduğunu) kanıtlamak.
test('modrinthVersionSelect: shaderStackService ile aynı fonksiyon kimliği (re-export kanıtı)', () => {
  for (const name of [
    'extractMcVersionFromModMeta',
    'modrinthLoaderModGameVersionCandidates',
    'modrinthClassicFallbacksForGameVersion',
    'modrinthGameVersionCandidates',
    'versionListsAnyGame',
    'modrinthCandidateRank',
    'pickNewestModrinthVersion',
    'glowingOresVariantLabel',
  ]) {
    assert.strictEqual(shader[name], vsel[name], `${name} aynı referans olmalı`);
  }
});

// Kurulum-akışı çekirdeği: 26.1.2 için yanlış patch'i (26.1.1 jar) SERT reddet.
// Bu tam olarak dünya yüklenirken NoSuchMethodError crash'ini önleyen kural.
test('versionMatchesGamePatch: 26.1.2 için 26.1.1-only sürüm reddedilir', () => {
  assert.strictEqual(
    vsel.versionMatchesGamePatch({ game_versions: ['26.1.1'] }, '26.1.2'),
    false
  );
  // 26.1.2 listeleyen, MC etiketi olmayan sürüm kabul edilir.
  assert.strictEqual(
    vsel.versionMatchesGamePatch({ game_versions: ['26.1.2', '26.1'] }, '26.1.2'),
    true
  );
  // 26.1.2 listeleyip mc26.1.1 etiketli sürüm uyumlu (geriye dönük) -> kabul.
  assert.strictEqual(
    vsel.versionMatchesGamePatch(
      { game_versions: ['26.1.2', '26.1'], files: [{ filename: 'sodium-mc26.1.1.jar' }] },
      '26.1.2'
    ),
    true
  );
  // Klasik 3-parçalı sürümde yanlış MC etiketi reddedilir.
  assert.strictEqual(
    vsel.versionMatchesGamePatch({ game_versions: ['1.21.1'], name: 'x mc1.21.2' }, '1.21.1'),
    false
  );
});

test('versionMatchesGameForFetch: strict patch vs gevşek eşleşme', () => {
  const v = { game_versions: ['26.1.1'] };
  assert.strictEqual(vsel.versionMatchesGameForFetch(v, '26.1.2', { strictPatch: true }), false);
  // gevşek modda 26.1 adayı üzerinden eşleşir (kaynak paketleri için).
  assert.strictEqual(vsel.versionMatchesGameForFetch({ game_versions: ['26.1'] }, '26.1.2'), true);
});

test('pickNewestModrinthVersion: strictPatch yanlış patch\'i eler', () => {
  const versions = [
    { id: 'wrong', game_versions: ['26.1.1'], version_type: 'release', date_published: '2026-02-01' },
    { id: 'right', game_versions: ['26.1.2'], version_type: 'release', date_published: '2026-01-01' },
  ];
  const picked = vsel.pickNewestModrinthVersion(versions, {
    gameVersion: '26.1.2', strictPatch: true, anchorTs: Date.parse('2026-03-01'),
  });
  assert.strictEqual(picked && picked.id, 'right');
});

test('pickNewestModrinthVersion: anchorTs sonrası yayınları eler', () => {
  const versions = [
    { id: 'future', game_versions: ['26.1.2'], version_type: 'release', date_published: '2026-06-01' },
    { id: 'past', game_versions: ['26.1.2'], version_type: 'release', date_published: '2026-01-01' },
  ];
  const picked = vsel.pickNewestModrinthVersion(versions, {
    gameVersion: '26.1.2', anchorTs: Date.parse('2026-03-01'),
  });
  assert.strictEqual(picked && picked.id, 'past'); // future, çapadan sonra -> elenir
});

test('pickGlowingOresVersion: border/default varyant seçimi', () => {
  const versions = [
    { id: 'b', game_versions: ['26.1.2'], name: 'Glowing Ores Border', date_published: '2026-02-01' },
    { id: 'd', game_versions: ['26.1.2'], name: 'Glowing Ores Default', date_published: '2026-01-01' },
  ];
  assert.strictEqual(vsel.pickGlowingOresVersion(versions, { gameVersion: '26.1.2', wantBorder: true }).id, 'b');
  assert.strictEqual(vsel.pickGlowingOresVersion(versions, { gameVersion: '26.1.2', wantBorder: false }).id, 'd');
  assert.strictEqual(vsel.pickGlowingOresVersion([], { gameVersion: '26.1.2', wantBorder: true }), null);
});

test('versionListsGame + expandResourcePackGameVersions: 26.1.x klasik fallback', () => {
  assert.strictEqual(vsel.versionListsGame(['1.21.11'], '26.1.2'), true); // classic fallback eşleşir
  assert.strictEqual(vsel.versionListsGame(['1.20'], '26.1.2'), false);
  assert.ok(vsel.expandResourcePackGameVersions('26.1.2').includes('1.21.11'));
});
