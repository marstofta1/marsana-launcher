'use strict';
// Marsana Lobi genişletmesini (97x97) üretir; mevcut 33x33 lobiye (merkezden ±16) dokunmaz:
//   node scripts/gen-lobby-expansion.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/expansion.mcfunction
// Merkez (0,0,0) = lobi merkezi marker'ı (ayak hizası); zemin y=-1. Dış duvar merkezden 48 blok uzakta.
// Yerleşim: 4 kapıdan dışarı yollar, KD etkinlik alanı, KB parkur, GB ve GD bahçe.
const out = [];
const c = (n) => (n === 0 ? '~' : `~${n}`);
const MAX = 32768; // /fill blok sınırı
const fill = (x1, y1, z1, x2, y2, z2, b) => {
  [x1, x2] = [Math.min(x1, x2), Math.max(x1, x2)];
  [y1, y2] = [Math.min(y1, y2), Math.max(y1, y2)];
  [z1, z2] = [Math.min(z1, z2), Math.max(z1, z2)];
  const slice = (z2 - z1 + 1) * (y2 - y1 + 1);
  const step = Math.max(1, Math.floor(MAX / slice));
  for (let x = x1; x <= x2; x += step) {
    out.push(`fill ${c(x)} ${c(y1)} ${c(z1)} ${c(Math.min(x + step - 1, x2))} ${c(y2)} ${c(z2)} ${b}`);
  }
};
const set = (x, y, z, b) => out.push(`setblock ${c(x)} ${c(y)} ${c(z)} ${b}`);
const R = 48; // dış duvar
const IN = 16; // mevcut lobinin dış sınırı (zemin dahil)
// Mevcut lobiyi dışarıda bırakan dört şerit: kuzey, güney, batı, doğu.
const ring = (y1, y2, b) => {
  fill(-R, y1, -R, R, y2, -IN - 1, b);
  fill(-R, y1, IN + 1, R, y2, R, b);
  fill(-R, y1, -IN, -IN - 1, y2, IN, b);
  fill(IN + 1, y1, -IN, R, y2, IN, b);
};
const sides = [(a, d) => [a, -d], (a, d) => [a, d], (a, d) => [-d, a], (a, d) => [d, a]];
const sideFill = (a1, y1, a2, y2, d, b) => {
  for (const s of sides) {
    const [x1, z1] = s(a1, d);
    const [x2, z2] = s(a2, d);
    fill(x1, y1, z1, x2, y2, z2, b);
  }
};
const sideSet = (a, y, d, b) => {
  for (const s of sides) {
    const [x, z] = s(a, d);
    set(x, y, z, b);
  }
};

out.push("# Üretilmiş dosya — elle düzenleme yerine scripts/gen-lobby-expansion.js'i güncelle.");
out.push('# Genişleme alanını temizle (mevcut lobiye dokunmaz), temel ve zemin');
ring(0, 24, 'minecraft:air');
ring(-6, -2, 'minecraft:stone_bricks');
ring(-1, -1, 'create:polished_cut_andesite');

out.push('# Kapılardan dış kapılara giden yollar ve yol fenerleri');
for (const s of sides) {
  const [x1, z1] = s(-1, IN + 1);
  const [x2, z2] = s(1, R);
  fill(x1, -1, z1, x2, -1, z2, 'create:cut_andesite_bricks');
}
for (let d = 20; d <= 44; d += 6) {
  for (const a of [-3, 3]) {
    sideFill(a, 0, a, 1, d, 'create:cut_andesite_wall');
    sideSet(a, 2, d, 'minecraft:lantern');
  }
}

out.push('# Dış duvarlar, pencereler, üst kenar, sütunlar');
sideFill(-R, 0, R, 6, R, 'create:cut_andesite_bricks');
for (let a = -44; a <= 40; a += 8) {
  if (a <= 4 && a + 4 >= -4) continue; // kapı çevresi
  sideFill(a, 2, a + 4, 4, R, 'create:framed_glass');
}
sideFill(-R, 7, R, 7, R, 'create:cut_andesite_slab');
for (let a = -40; a <= 40; a += 8) {
  if (a === 0) continue;
  sideFill(a, 0, a, 7, R, 'create:andesite_casing');
  sideSet(a, 8, R, 'minecraft:lantern');
}
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    fill(46 * sx, 0, 46 * sz, R * sx, 9, R * sz, 'create:andesite_casing');
    fill(46 * sx, 6, 46 * sz, R * sx, 6, R * sz, 'create:copper_casing');
    set(47 * sx, 10, 47 * sz, 'minecraft:lantern');
  }
}

out.push('# Dış kapılar (pirinç çerçeve, 3 geniş x 4 yüksek)');
sideFill(-2, 0, 2, 5, R, 'create:brass_casing');
sideFill(-1, 0, 1, 3, R, 'minecraft:air');

out.push('# KD: Etkinlik alanı (x 18..42, z -42..-18)');
fill(18, -1, -42, 42, -1, -18, 'create:brass_casing');
fill(19, -1, -41, 41, -1, -19, 'minecraft:waxed_cut_copper');
fill(26, -1, -34, 34, -1, -26, 'create:polished_cut_andesite');
fill(29, -1, -31, 31, -1, -29, 'minecraft:gold_block');
// Çevre çiti (yollara bakan batı ve güney kenarda giriş)
fill(18, 0, -42, 42, 0, -42, 'create:andesite_bars');
fill(42, 0, -42, 42, 0, -18, 'create:andesite_bars');
fill(18, 0, -42, 18, 0, -18, 'create:andesite_bars');
fill(18, 0, -18, 42, 0, -18, 'create:andesite_bars');
fill(18, 0, -32, 18, 0, -28, 'minecraft:air');
fill(28, 0, -18, 32, 0, -18, 'minecraft:air');
// Sahne (doğu kenarı)
fill(37, 0, -34, 41, 0, -26, 'create:polished_cut_andesite');
fill(37, 1, -34, 41, 1, -34, 'create:polished_cut_andesite_wall');
fill(37, 1, -26, 41, 1, -26, 'create:polished_cut_andesite_wall');
for (const [x, z] of [[19, -41], [41, -41], [19, -19], [41, -19]]) {
  fill(x, 0, z, x, 3, z, 'create:andesite_casing');
  set(x, 4, z, 'minecraft:lantern');
}

out.push('# KB: Parkur (yeşil başlangıç, altın bitiş)');
fill(-21, 0, -23, -19, 0, -21, 'minecraft:lime_concrete');
const jumps = [
  [-23, 1, -22], [-26, 1, -22], [-29, 2, -22], [-32, 2, -22], [-35, 3, -22], [-38, 3, -22],
  [-40, 4, -24], [-40, 4, -27], [-40, 5, -30], [-40, 5, -33], [-38, 6, -36], [-35, 6, -38],
  [-32, 7, -38], [-29, 7, -38], [-26, 8, -38], [-23, 8, -36],
];
for (const [x, y, z] of jumps) set(x, y, z, 'minecraft:light_blue_concrete');
fill(-22, 8, -34, -20, 8, -32, 'minecraft:gold_block');
set(-22, 9, -34, 'minecraft:lantern');

out.push('# GB ve GD: Bahçeler (çim, havuz, ağaçlar, çiçekler, banklar)');
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const flowers = ['minecraft:poppy', 'minecraft:dandelion', 'minecraft:cornflower', 'minecraft:allium',
  'minecraft:oxeye_daisy', 'minecraft:azure_bluet', 'minecraft:lily_of_the_valley', 'minecraft:short_grass'];
for (const sx of [-1, 1]) {
  const X = (a) => a * sx;
  fill(X(18), -1, 18, X(42), -1, 42, 'minecraft:grass_block');
  // Havuz
  fill(X(26), -2, 26, X(34), -1, 34, 'minecraft:water');
  fill(X(25), -1, 25, X(35), -1, 25, 'create:cut_andesite_bricks');
  fill(X(25), -1, 35, X(35), -1, 35, 'create:cut_andesite_bricks');
  fill(X(25), -1, 25, X(25), -1, 35, 'create:cut_andesite_bricks');
  fill(X(35), -1, 25, X(35), -1, 35, 'create:cut_andesite_bricks');
  for (const [x, z] of [[28, 28], [32, 31], [29, 33]]) set(X(x), 0, z, 'minecraft:lily_pad');
  // Ağaçlar
  for (const [x, z] of [[21, 21], [39, 22], [21, 39], [39, 39], [30, 40]]) {
    out.push(`place feature minecraft:oak ${c(X(x))} ~ ${c(z)}`);
  }
  // Çiçekler (havuzun ve ağaçların dışında)
  for (let i = 0; i < 40; i++) {
    const x = 19 + Math.floor(rnd() * 23);
    const z = 19 + Math.floor(rnd() * 23);
    if (x >= 24 && x <= 36 && z >= 24 && z <= 36) continue;
    set(X(x), 0, z, flowers[Math.floor(rnd() * flowers.length)]);
  }
  // Banklar ve fenerler
  for (const z of [27, 33]) {
    set(X(23), 0, z, `minecraft:spruce_stairs[facing=${sx > 0 ? 'west' : 'east'}]`);
    set(X(37), 0, z, `minecraft:spruce_stairs[facing=${sx > 0 ? 'east' : 'west'}]`);
  }
  for (const [x, z] of [[24, 24], [36, 24], [24, 36], [36, 36]]) {
    set(X(x), 0, z, 'create:cut_andesite_wall');
    set(X(x), 1, z, 'minecraft:lantern');
  }
}

process.stdout.write(out.join('\n') + '\n');
