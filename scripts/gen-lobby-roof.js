'use strict';
// Marsana Lobi tavanını üretir (97x97, cam + andezit kirişler, istasyon çatısı tarzı):
//   node scripts/gen-lobby-roof.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/roof.mcfunction
// Merkez (0,0,0) = lobi merkezi marker'ı (ayak hizası). Tavan y=14'te; altındaki hiçbir şeye dokunmaz.
// Dış duvarlar (merkezden 48) tavana kadar yükseltilir; iç lobi aynen kalır.
const out = [];
const c = (n) => (n === 0 ? '~' : `~${n}`);
const fill = (x1, y1, z1, x2, y2, z2, b) =>
  out.push(`fill ${c(x1)} ${c(y1)} ${c(z1)} ${c(x2)} ${c(y2)} ${c(z2)} ${b}`);
const set = (x, y, z, b) => out.push(`setblock ${c(x)} ${c(y)} ${c(z)} ${b}`);
const R = 48;
const Y = 14; // tavan yüksekliği
const sides = [(a, d) => [a, -d], (a, d) => [a, d], (a, d) => [-d, a], (a, d) => [d, a]];
const sideFill = (a1, y1, a2, y2, d, b) => {
  for (const s of sides) {
    const [x1, z1] = s(a1, d);
    const [x2, z2] = s(a2, d);
    fill(x1, y1, z1, x2, y2, z2, b);
  }
};

out.push("# Üretilmiş dosya — elle düzenleme yerine scripts/gen-lobby-roof.js'i güncelle.");
out.push('# Dış duvarları tavana kadar yükselt (pencereli), sütunları uzat');
sideFill(-R, 7, R, Y - 1, R, 'create:cut_andesite_bricks');
for (let a = -44; a <= 40; a += 8) {
  if (a <= 4 && a + 4 >= -4) continue;
  sideFill(a, 9, a + 4, 12, R, 'create:framed_glass');
}
for (let a = -40; a <= 40; a += 8) {
  if (a === 0) continue;
  sideFill(a, 7, a, Y - 1, R, 'create:andesite_casing');
}
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    fill(46 * sx, 10, 46 * sz, R * sx, Y + 1, R * sz, 'create:andesite_casing');
    set(47 * sx, Y + 2, 47 * sz, 'minecraft:lantern');
  }
}

out.push('# Cam tavan ve andezit kiriş ızgarası (her 8 blokta)');
fill(-R, Y, -R, R, Y, R, 'create:framed_glass');
for (let a = -R; a <= R; a += 8) {
  fill(a, Y, -R, a, Y, R, 'create:andesite_casing');
  fill(-R, Y, a, R, Y, a, 'create:andesite_casing');
}
fill(-R, Y, -R, R, Y, -R, 'create:andesite_casing');
fill(-R, Y, R, R, Y, R, 'create:andesite_casing');
fill(-R, Y, -R, -R, Y, R, 'create:andesite_casing');
fill(R, Y, -R, R, Y, R, 'create:andesite_casing');

out.push('# Kiriş kesişimlerinden sarkan fenerler (her 16 blokta)');
for (let x = -32; x <= 32; x += 16) {
  for (let z = -32; z <= 32; z += 16) {
    set(x, Y - 1, z, 'minecraft:lantern[hanging=true]');
  }
}

process.stdout.write(out.join('\n') + '\n');
