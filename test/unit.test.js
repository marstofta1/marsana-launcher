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
