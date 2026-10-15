'use strict';
// Marsana Lobi datapack'inin structure.mcfunction dosyasını üretir:
//   node scripts/gen-lobby-structure.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/structure.mcfunction
// Merkez (0,0,0) = oyuncunun ayak hizası; zemin y=-1.
const out = [];
const c = (n) => (n === 0 ? '~' : `~${n}`);
const fill = (x1, y1, z1, x2, y2, z2, b) =>
  out.push(`fill ${c(x1)} ${c(y1)} ${c(z1)} ${c(x2)} ${c(y2)} ${c(z2)} ${b}`);
const set = (x, y, z, b) => out.push(`setblock ${c(x)} ${c(y)} ${c(z)} ${b}`);
// Duvar düzleminde (a = duvar boyunca, d = merkezden uzaklık) → 4 yön.
const sides = [
  (a, d) => [a, -d], // kuzey
  (a, d) => [a, d], // güney
  (a, d) => [-d, a], // batı
  (a, d) => [d, a], // doğu
];
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
const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

out.push("# Üretilmiş dosya — elle düzenleme yerine scripts/gen-lobby-structure.js'i güncelle.");
out.push('# Alanı temizle, temel ve zemin');
fill(-17, 0, -17, 17, 15, 17, 'minecraft:air');
fill(-16, -6, -16, 16, -2, 16, 'minecraft:stone_bricks');
fill(-16, -1, -16, 16, -1, 16, 'create:polished_cut_andesite');

out.push('# Kapılara giden yollar ve merkez madalyonu (doğuş noktası)');
fill(-1, -1, -16, 1, -1, 16, 'create:cut_andesite_bricks');
fill(-16, -1, -1, 16, -1, 1, 'create:cut_andesite_bricks');
fill(-4, -1, -4, 4, -1, 4, 'minecraft:waxed_cut_copper');
fill(-3, -1, -3, 3, -1, 3, 'create:polished_cut_andesite');
fill(-1, -1, -1, 1, -1, 1, 'create:brass_block');

out.push('# Duvarlar, pencereler ve üst kenar');
sideFill(-15, 0, 15, 4, 15, 'create:cut_andesite_bricks');
for (const [a1, a2] of [[-13, -11], [-9, -6], [6, 9], [11, 13]]) {
  sideFill(a1, 1, a2, 3, 15, 'create:framed_glass');
}
sideFill(-15, 5, 15, 5, 15, 'create:cut_andesite_slab');

out.push('# Sütunlar ve üstlerinde fenerler');
for (const a of [-10, -5, 5, 10]) {
  sideFill(a, 0, a, 5, 15, 'create:andesite_casing');
  sideSet(a, 6, 15, 'minecraft:lantern');
}

out.push('# Kapılar (pirinç çerçeve, 3 geniş x 3 yüksek)');
sideFill(-2, 0, 2, 4, 15, 'create:brass_casing');
sideFill(-1, 0, 1, 2, 15, 'minecraft:air');

out.push('# Köşe kuleleri');
for (const [sx, sz] of corners) {
  fill(14 * sx, 0, 14 * sz, 16 * sx, 7, 16 * sz, 'create:andesite_casing');
  fill(14 * sx, 4, 14 * sz, 16 * sx, 4, 16 * sz, 'create:copper_casing');
  set(15 * sx, 8, 15 * sz, 'minecraft:lantern');
}

out.push('# Fener direkleri');
const posts = [[4, 4], [2, 9], [9, 2]];
for (const [px, pz] of posts) {
  for (const [sx, sz] of corners) {
    fill(px * sx, 0, pz * sz, px * sx, 2, pz * sz, 'create:cut_andesite_wall');
    set(px * sx, 3, pz * sz, 'minecraft:lantern');
  }
}

out.push('# İç köşelerde saksılar');
for (const [sx, sz] of corners) {
  fill(10 * sx, -1, 10 * sz, 12 * sx, -1, 12 * sz, 'minecraft:moss_block');
  set(11 * sx, 0, 11 * sz, 'minecraft:flowering_azalea');
}

process.stdout.write(out.join('\n') + '\n');
