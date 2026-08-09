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
