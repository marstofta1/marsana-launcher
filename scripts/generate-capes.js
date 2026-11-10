'use strict';

// Marsana Client pelerin dokularını üretir (özgün tasarımlar, 64x32 vanilla pelerin düzeni).
// Çalıştır: node scripts/generate-capes.js
//  → marsana-client-mod/src/main/resources/assets/marsana-client/textures/cosmetic/<id>.png (oyun)
//  → src/renderer/assets/capes/<id>.png (launcher önizlemesi)
// Pelerin eklerken: buraya, src/shared/marsanaClient.js COSMETIC_ITEMS'a ve
// CosmeticsManager.OPTIONS'a aynı id ile ekle; sonra modu derle (npm run build:client-mod).

const fs = require('fs');
const path = require('path');
const { encodePng } = require('../src/core/skins/png');

const ROOT = path.join(__dirname, '..');
const OUT_DIRS = [
  path.join(ROOT, 'marsana-client-mod', 'src', 'main', 'resources', 'assets', 'marsana-client', 'textures', 'cosmetic'),
  path.join(ROOT, 'src', 'renderer', 'assets', 'capes'),
];

const W = 10; // pelerin yüzü genişliği
const H = 16; // pelerin yüzü yüksekliği

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}
function scale(c, f) {
  return c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
}
// Tekrarlanabilir sözde rastgele (tasarım her çalıştırmada aynı çıksın).
function rand(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Piksel haritası: satırlar + palet. '.' = taban fonksiyonu. */
function fromMap(rows, palette, base) {
  return (u, v) => {
    const ch = (rows[v] || '')[u];
    if (ch && ch !== '.' && palette[ch]) return hex(palette[ch]);
    return base(u, v);
  };
}

// Her pelerin: dış yüz (arkadan görünen) fonksiyonu + kenar (trim) rengi.
const CAPES = [
  {
    id: 'marsana-green',
    trim: '#1f5c37',
    outer: fromMap(
      [
        '..........', '.YYYYYYYY.', '..........', '..........',
        '..W....W..', '..WW..WW..', '..W.WW.W..', '..W....W..',
        '..W....W..', '..W....W..', '..........', '..........',
        '..........', '.YYYYYYYY.', '..........', '..........',
      ],
      { W: '#eaf7ee', Y: '#8fd19e' },
      (u, v) => mix(hex('#3d9a5f'), hex('#2b7546'), v / (H - 1))
    ),
  },
  {
    id: 'marsana-night',
    trim: '#0c1426',
    outer: fromMap(
      [
        '..........', '......YY..', '.....Y....', '.....Y....',
        '......YY..', '..........', '..........', '..........',
        '..........', '..........', '..........', '..........',
        '..........', '..........', '..........', '..........',
      ],
      { Y: '#f3e6a0' },
      (u, v) => {
        const base = mix(hex('#24365e'), hex('#0f1830'), v / (H - 1));
        const r = rand(u, v, 2);
        if (r > 0.93) return hex('#ffffff');
        if (r > 0.88) return hex('#9fb4e0');
        return base;
      }
    ),
  },
  {
    id: 'marsana-gold',
    trim: '#7a5c0f',
    outer: (u, v) => {
      // Elmas desen + üst/alt şerit.
      if (v === 1 || v === H - 2) return hex('#fff1b0');
      const d = (u + v) % 4 === 0 || (u - v + 40) % 4 === 0;
      const base = mix(hex('#e0b53a'), hex('#a8801c'), v / (H - 1));
      return d ? scale(base, 1.18) : base;
    },
  },
  {
    id: 'flame',
    label: 'Alev',
    trim: '#5a0e0a',
    outer: (u, v) => {
      // Alttan yükselen dalgalı alevler.
      const t = v / (H - 1);
      const wave = Math.sin(u * 1.3 + rand(u, 0, 4) * 2) * 2 + rand(u, v, 4) * 1.5;
      const height = t * H + wave; // büyük = daha alevli
      if (height > 14) return hex('#fff3a3');
      if (height > 11.5) return hex('#ffc93c');
      if (height > 8.5) return hex('#ff7a1a');
      if (height > 5.5) return hex('#d6301c');
      return mix(hex('#3a0906'), hex('#7a140c'), t);
    },
  },
  {
    id: 'ocean',
    label: 'Okyanus',
    trim: '#0a2f4a',
    outer: (u, v) => {
      const band = v + Math.round(Math.sin(u * 0.9 + v * 0.3) * 1.2);
      const base = mix(hex('#3fb6e0'), hex('#0d3d66'), v / (H - 1));
      if (band % 4 === 0) return mix(base, hex('#e8fbff'), 0.55);
      if (band % 4 === 1) return scale(base, 1.1);
      return base;
    },
  },
  {
    id: 'galaxy',
    label: 'Galaksi',
    trim: '#170a2e',
    outer: (u, v) => {
      // Çapraz bir nebula kuşağı + yıldızlar.
      const dist = Math.abs(u - (v * 0.55 + 1)) / 4;
      const nebula = Math.max(0, 1 - dist);
      let c = mix(hex('#1a0f3a'), hex('#0a0820'), v / (H - 1));
      c = mix(c, rand(u, v, 9) > 0.5 ? hex('#b04fd6') : hex('#4f6cf0'), nebula * 0.75);
      const r = rand(u, v, 7);
      if (r > 0.95) return hex('#ffffff');
      if (r > 0.91) return hex('#ffd6ff');
      return c;
    },
  },
  {
    id: 'forest',
    label: 'Orman',
    trim: '#1e2d14',
    outer: (u, v) => {
      // Gün batımı gökyüzü önünde çam ağaçları.
      const sky = mix(hex('#f4b26a'), hex('#c4566b'), v / 8);
      const trees = [
        { x: 2, top: 6 },
        { x: 6, top: 4 },
        { x: 9, top: 8 },
      ];
      for (const t of trees) {
        const halfWidth = Math.floor((v - t.top) / 2);
        if (v >= t.top && Math.abs(u - t.x) <= halfWidth) return v > 13 ? hex('#1b3a1e') : hex('#2d5a2f');
      }
      if (v >= 13) return hex('#24401f');
      if (v === 2 && (u === 7 || u === 8)) return hex('#fff2b8'); // güneş
      if (v === 3 && u >= 6 && u <= 9) return hex('#ffe08a');
      return sky;
    },
  },
  {
    id: 'rainbow',
    label: 'Gökkuşağı',
    trim: '#2a2a2a',
    outer: (u, v) => {
      const colors = ['#e63946', '#f4802c', '#f7cf3b', '#4cbb5e', '#3a86d4', '#7b4fc9'];
      const idx = Math.floor((v + Math.floor(u / 5)) / (H / colors.length)) % colors.length;
      const c = hex(colors[idx]);
      return (u + v) % 2 === 0 ? c : scale(c, 0.93);
    },
  },
  {
    id: 'frost',
    label: 'Buz',
    trim: '#5e8fb3',
    outer: fromMap(
      [
        '..........', '..........', '....W.....', '..W.W.W...',
        '...WWW....', '.WWWLWWW..', '...WWW....', '..W.W.W...',
        '....W.....', '..........', '......W...', '.....WLW..',
        '......W...', '..........', '..........', '..........',
      ],
      { W: '#ffffff', L: '#bfe9ff' },
      (u, v) => {
        const base = mix(hex('#cdeefc'), hex('#6fb2dc'), v / (H - 1));
        return rand(u, v, 11) > 0.85 ? scale(base, 1.08) : base;
      }
    ),
  },
  {
    id: 'dragon',
    label: 'Ejderha',
    trim: '#0f2a18',
    outer: (u, v) => {
      // Üst üste binen pul deseni.
      const row = Math.floor(v / 2);
      const offset = row % 2 === 0 ? 0 : 1;
      const local = (u + offset) % 2;
      const edge = v % 2 === 1 && local === 0;
      const base = mix(hex('#3aa860'), hex('#14512a'), v / (H - 1));
      if (edge) return scale(base, 0.62);
      return local === 1 ? scale(base, 1.15) : base;
    },
  },
  {
    id: 'sakura',
    label: 'Sakura',
    trim: '#8a3e5c',
    outer: fromMap(
      [
        '..........', '.P......P.', 'PCP....PCP', '.P...P..P.',
        '....PCP...', '.....P....', '..P.......', '.PCP....P.',
        '..P....PCP', '........P.', '...P......', '..PCP.....',
        '...P...P..', '.......CP.', '..........', '..........',
      ],
      { P: '#ffffff', C: '#ffd84a' },
      (u, v) => mix(hex('#ffc6dc'), hex('#e889ad'), v / (H - 1))
    ),
  },
  {
    id: 'storm',
    label: 'Şimşek',
    trim: '#000000',
    outer: fromMap(
      [
        '..........', '......YY..', '.....YY...', '....YY....',
        '...YY.....', '..YYYYYY..', '.....YY...', '....YY....',
        '...YY.....', '..YY......', '.YY.......', '..........',
        '..........', '..........', '..........', '..........',
      ],
      { Y: '#ffe14d' },
      (u, v) => {
        const base = mix(hex('#3a3f4a'), hex('#14161b'), v / (H - 1));
        return rand(u, v, 13) > 0.8 ? scale(base, 1.2) : base;
      }
    ),
  },
];

function renderCape(cape) {
  const rgba = Buffer.alloc(64 * 32 * 4);
  const put = (x, y, c) => {
    const i = (y * 64 + x) * 4;
    rgba[i] = c[0];
    rgba[i + 1] = c[1];
    rgba[i + 2] = c[2];
    rgba[i + 3] = 255;
  };
  const trim = hex(cape.trim);
  // Dış yüz (arkadan görünen) x 1..10, y 1..16 — kenarı ince trim çizgisiyle.
  for (let v = 0; v < H; v += 1) {
    for (let u = 0; u < W; u += 1) {
      const border = u === 0 || u === W - 1 || v === H - 1;
      put(1 + u, 1 + v, border ? mix(cape.outer(u, v), trim, 0.65) : cape.outer(u, v));
    }
  }
  // İç yüz (oyuncunun sırtına bakan) x 12..21: dış yüzün koyu, düz tonu.
  const inner = scale(cape.outer(4, 6), 0.55);
  for (let v = 0; v < H; v += 1) for (let u = 0; u < W; u += 1) put(12 + u, 1 + v, inner);
  // Yanlar, üst ve alt kenar: trim.
  for (let v = 0; v < H; v += 1) {
    put(0, 1 + v, trim);
    put(11, 1 + v, trim);
  }
  for (let u = 0; u < W; u += 1) {
    put(1 + u, 0, trim);
    put(11 + u, 0, trim);
  }
  return encodePng(64, 32, rgba);
}

function main() {
  for (const dir of OUT_DIRS) fs.mkdirSync(dir, { recursive: true });
  for (const cape of CAPES) {
    const png = renderCape(cape);
    for (const dir of OUT_DIRS) fs.writeFileSync(path.join(dir, `${cape.id}.png`), png);
    console.log(`yazıldı: ${cape.id}`);
  }
}

if (require.main === module) main();

module.exports = { CAPES };
