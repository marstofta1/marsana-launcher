'use strict';

// Launcher'daki hazır skin galerisinin PNG'lerini üretir (özgün tasarımlar, klasik/Steve kalıbı).
// Çalıştır: node scripts/generate-preset-skins.js  →  src/renderer/assets/skins/<id>.png
// Tasarımı değiştirdiysen yeniden çalıştırıp çıkan PNG'leri commit'le.

const fs = require('fs');
const path = require('path');
const { encodePng } = require('../src/core/skins/png');

const OUT_DIR = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'skins');

// 64x64 skin düzeni: her parça bir küp; [ox, oy, genişlik, yükseklik, derinlik].
const PARTS = {
  head: [0, 0, 8, 8, 8],
  hat: [32, 0, 8, 8, 8],
  body: [16, 16, 8, 12, 4],
  jacket: [16, 32, 8, 12, 4],
  rarm: [40, 16, 4, 12, 4],
  rsleeve: [40, 32, 4, 12, 4],
  larm: [32, 48, 4, 12, 4],
  lsleeve: [48, 48, 4, 12, 4],
  rleg: [0, 16, 4, 12, 4],
  rpants: [0, 32, 4, 12, 4],
  lleg: [16, 48, 4, 12, 4],
  lpants: [0, 48, 4, 12, 4],
};

function faceRects([ox, oy, w, h, d]) {
  return {
    top: [ox + d, oy, w, d],
    bottom: [ox + d + w, oy, w, d],
    right: [ox, oy + d, d, h],
    front: [ox + d, oy + d, w, h],
    left: [ox + d + w, oy + d, d, h],
    back: [ox + 2 * d + w, oy + d, w, h],
  };
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function createSkin(palette, seed) {
  const rgba = Buffer.alloc(64 * 64 * 4);
  const colors = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, hex(v)]));

  function put(x, y, key) {
    if (key == null || key === '.' || key === ' ') return;
    const c = colors[key];
    if (!c) throw new Error(`Palette anahtarı yok: ${key}`);
    // Hafif, tekrarlanabilir doku gürültüsü — düz renkler oyunda plastik durur.
    const hash = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
    const f = 1 + ((hash % 9) - 4) / 100;
    const i = (y * 64 + x) * 4;
    rgba[i] = Math.max(0, Math.min(255, Math.round(c[0] * f)));
    rgba[i + 1] = Math.max(0, Math.min(255, Math.round(c[1] * f)));
    rgba[i + 2] = Math.max(0, Math.min(255, Math.round(c[2] * f)));
    rgba[i + 3] = 255;
  }

  function resolve(filler, u, v, face) {
    if (filler == null) return null;
    if (typeof filler === 'string') return filler;
    if (Array.isArray(filler)) return (filler[v] || '')[u] || null;
    return filler(u, v, face);
  }

  /** spec: { all, side, top, bottom, front, back, left, right } — anahtar, satır dizisi ya da (u,v)=>anahtar. */
  function paint(partName, spec) {
    const part = PARTS[partName];
    const h = part[3];
    const rects = faceRects(part);
    for (const [face, [fx, fy, fw, fh]] of Object.entries(rects)) {
      let filler = spec[face];
      if (filler === undefined && (face === 'left' || face === 'right' || face === 'back')) filler = spec.side;
      if (filler === undefined) filler = spec.all;
      for (let v = 0; v < fh; v += 1) {
        for (let u = 0; u < fw; u += 1) {
          // Üst/alt yüz, yan yüzlerin ilk/son satırının rengini alır (aksi belirtilmedikçe).
          const row = face === 'top' && spec.top === undefined ? 0 : face === 'bottom' && spec.bottom === undefined ? h - 1 : v;
          put(fx + u, fy + v, resolve(filler, u, row, face));
        }
      }
    }
  }

  return { paint, rgba };
}

// Satır aralığına göre renk: rows(['A', 0, 6], ['B', 7, 11]).
function rows(...bands) {
  return (_u, v) => {
    for (const [key, from, to] of bands) if (v >= from && v <= to) return key;
    return null;
  };
}

const SKINS = [
  {
    id: 'ninja',
    palette: { K: '#1d1d24', k: '#2c2c38', R: '#b3262d', S: '#d29a6f', W: '#f2f2f2', E: '#3a2a1e', g: '#5a5a66', B: '#111114' },
    draw({ paint }) {
      paint('head', {
        all: rows(['K', 0, 0], ['R', 1, 1], ['K', 2, 7]),
        top: 'K',
        front: ['KKKKKKKK', 'RRRRRRRR', 'KKKKKKKK', 'SSSSSSSS', 'SWESSEWS', 'KKKKKKKK', 'KkKKKKkK', 'KKKKKKKK'],
        back: ['KKKKKKKK', 'RRRRRRRR', 'KKKRRKKK', 'KKRKKRKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK'],
      });
      paint('body', {
        all: rows(['K', 0, 6], ['R', 7, 7], ['k', 8, 11]),
        front: ['KKKKKKkK', 'KKKKKkKK', 'KKKKkKKK', 'KKKkKKKK', 'KKkKKKKK', 'KkKKKKKK', 'KKKKKKKK', 'RRRRRRRR', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['K', 0, 8], ['g', 9, 10], ['S', 11, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['k', 0, 6], ['g', 7, 7], ['k', 8, 9], ['B', 10, 11]) });
    },
  },
  {
    id: 'astronaut',
    palette: { W: '#e9edf2', w: '#c3cbd6', V: '#1d3557', v: '#5d8fb8', O: '#f28c28', G: '#7d8796', R: '#d64545', B: '#3d7bd6', Y: '#f2c94c' },
    draw({ paint }) {
      paint('head', {
        all: 'W',
        bottom: 'G',
        front: ['wWWWWWWw', 'WWWWWWWW', 'WVVVVVVW', 'WVvVVVVW', 'WVVvVVVW', 'WVVVVVVW', 'WWWWWWWW', 'wGGGGGGw'],
        side: rows(['W', 0, 2], ['w', 3, 4], ['W', 5, 6], ['G', 7, 7]),
      });
      paint('body', {
        all: rows(['G', 0, 0], ['W', 1, 6], ['O', 7, 7], ['W', 8, 11]),
        front: ['GGGGGGGG', 'WWWWWWWW', 'WGGGGGWW', 'WGRBYGWW', 'WGGGGGWW', 'WWWWWWWW', 'WWWWWWWW', 'OOOOOOOO', 'WWWWWWWW', 'WWWWWWWW', 'WWwWWwWW', 'WWWWWWWW'],
        back: ['GGGGGGGG', 'GwwwwwwG', 'GwGGGGwG', 'GwGOOGwG', 'GwGGGGwG', 'GwGOOGwG', 'GwGGGGwG', 'GwwwwwwG', 'GGGGGGGG', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['W', 0, 2], ['O', 3, 3], ['W', 4, 9], ['G', 10, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['W', 0, 5], ['w', 6, 6], ['W', 7, 8], ['G', 9, 11]) });
    },
  },
  {
    id: 'knight',
    palette: { M: '#9aa3ad', m: '#6d7681', L: '#c9d0d7', X: '#16161a', B: '#2b4c9b', Y: '#e3b23c', P: '#b8302f' },
    draw({ paint }) {
      paint('head', {
        all: rows(['M', 0, 6], ['m', 7, 7]),
        top: 'L',
        front: ['mMMMMMMm', 'MLMMMMLM', 'MMMMMMMM', 'MMMMMMMM', 'MXXXXXXM', 'MMMMMMMM', 'MmXmmXmM', 'mMMMMMMm'],
      });
      // Miğferin tepesinde kırmızı tüy (şapka katmanı).
      paint('hat', { all: null, top: ['...PP...', '...PP...', '...PP...', '...PP...', '...PP...', '...PP...', '...PP...', '...PP...'], back: ['...PP...', '...PP...', '....P...'] });
      paint('body', {
        all: rows(['M', 0, 6], ['m', 7, 7], ['M', 8, 11]),
        front: ['MBBBBBBM', 'MBBYYBBM', 'MBBYYBBM', 'MYYYYYYM', 'MBBYYBBM', 'MBBYYBBM', 'MBBBBBBM', 'YmmmmmmY', 'MBBBBBBM', 'MBBBBBBM', 'MBBBBBBM', 'MBBBBBBM'],
        back: rows(['M', 0, 6], ['m', 7, 7], ['B', 8, 11]),
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['L', 0, 0], ['M', 1, 2], ['m', 3, 3], ['M', 4, 6], ['m', 7, 7], ['M', 8, 9], ['m', 10, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['M', 0, 4], ['L', 5, 5], ['M', 6, 9], ['m', 10, 11]) });
    },
  },
  {
    id: 'robot',
    palette: { R: '#5c6b7a', r: '#46525e', l: '#8796a6', C: '#2fe3ff', c: '#1aa7c4', Y: '#ffcc33', K: '#1c2128' },
    draw({ paint }) {
      paint('head', {
        all: rows(['R', 0, 6], ['r', 7, 7]),
        top: 'l',
        front: ['rRRRRRRr', 'RlRRRRlR', 'RRRRRRRR', 'RKKRRKKR', 'RCCRRCCR', 'RRRRRRRR', 'RKYKKYKR', 'rRRRRRRr'],
        side: ['RRRRRRRR', 'RRRRRRRR', 'RRRKKRRR', 'RRKYYKRR', 'RRRKKRRR', 'RRRRRRRR', 'RRRRRRRR', 'rrrrrrrr'],
      });
      paint('hat', { all: null, top: ['........', '........', '........', '...YY...', '...YY...', '........', '........', '........'] });
      paint('body', {
        all: rows(['R', 0, 6], ['r', 7, 7], ['R', 8, 11]),
        front: ['rRRRRRRr', 'RRRRRRRR', 'RKKKKKKR', 'RKCKKYKR', 'RKKKKKKR', 'RRRRRRRR', 'RlRRRRlR', 'rrrrrrrr', 'RRRRRRRR', 'RRRccRRR', 'RRRRRRRR', 'rRRRRRRr'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['l', 0, 0], ['R', 1, 3], ['r', 4, 4], ['R', 5, 7], ['r', 8, 8], ['R', 9, 9], ['K', 10, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['R', 0, 4], ['r', 5, 5], ['R', 6, 9], ['K', 10, 11]) });
    },
  },
  {
    id: 'pirate',
    palette: { S: '#c98a5e', s: '#a96f48', D: '#a3202a', d: '#7d1820', W: '#ece6d6', V: '#5a3a22', P: '#26262c', B: '#3b2617', E: '#2d1f14', H: '#111111', M: '#3b2a1c', G: '#e0b34a' },
    draw({ paint }) {
      paint('head', {
        all: rows(['D', 0, 1], ['M', 2, 3], ['S', 4, 7]),
        top: 'D',
        front: ['DDDDDDDD', 'DdDDDDdD', 'SSSSSSHS', 'SSSSSHSS', 'SWESHHHS', 'SSSssHSS', 'SMMSSMMS', 'SMMMMMMS'],
        back: ['DDDDDDDD', 'DdDDDDdD', 'MMMDDMMM', 'MMMdDMMM', 'MMMMMMMM', 'MMMMMMMM', 'MMMMMMMM', 'MMMMMMMM'],
      });
      paint('body', {
        all: rows(['V', 0, 6], ['B', 7, 7], ['P', 8, 11]),
        front: ['VWSSSSWV', 'VWWSSWWV', 'VWWWWWWV', 'VWWWWWWV', 'VWWWWWWV', 'VWWWWWWV', 'VWWWWWWV', 'BBBBGBBB', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['W', 0, 8], ['S', 9, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['P', 0, 6], ['B', 7, 11]) });
    },
  },
  {
    id: 'frost-mage',
    palette: { B: '#2f6fb0', b: '#24568a', L: '#9fd3ff', W: '#f2f5f8', w: '#cfd8e0', S: '#e0b08a', H: '#3b7fc6', N: '#1c3550' },
    draw({ paint }) {
      paint('head', {
        all: rows(['H', 0, 1], ['W', 2, 7]),
        top: 'H',
        front: ['HHHHHHHH', 'HLLLLLLH', 'WSSSSSSW', 'WSSSSSSW', 'WLLSSLLW', 'WSSWWSSW', 'WWWWWWWW', 'wWWWWWWw'],
      });
      paint('hat', { all: rows(['H', 0, 0], ['L', 1, 1]), top: 'H', front: ['HHHHHHHH', 'LLLLLLLL'] });
      paint('body', {
        all: rows(['B', 0, 6], ['L', 7, 7], ['B', 8, 11]),
        front: ['BWWWWWWB', 'BWWWWWWB', 'BBWWWWBB', 'BBBWWBBB', 'BBBLLBBB', 'BBBLLBBB', 'BBBLLBBB', 'LLLLLLLL', 'BBBLLBBB', 'BBBLLBBB', 'BBBLLBBB', 'BBBLLBBB'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['B', 0, 8], ['L', 9, 9], ['S', 10, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['b', 0, 9], ['L', 10, 10], ['N', 11, 11]) });
    },
  },
  {
    id: 'miner',
    palette: { Y: '#e8b923', y: '#c4961a', A: '#fff6b0', S: '#c68c63', s: '#a8724d', E: '#2b1d12', W: '#f2f2f2', O: '#f07a1a', o: '#ffd54a', G: '#6b6f75', J: '#2f4f86', j: '#253f6b', B: '#4a3320', M: '#3a2a1e', T: '#8a5a2b' },
    draw({ paint }) {
      paint('head', {
        all: rows(['Y', 0, 1], ['y', 2, 2], ['S', 3, 7]),
        front: ['YYYAAYYY', 'yYYAAYYy', 'yyyyyyyy', 'SSSSSSSS', 'SWESSEWS', 'SSSssSSS', 'SSMMMMSS', 'SSSSSSSS'],
        back: rows(['Y', 0, 1], ['y', 2, 2], ['M', 3, 7]),
        top: 'Y',
      });
      paint('body', {
        all: rows(['O', 0, 2], ['o', 3, 3], ['O', 4, 5], ['o', 6, 6], ['B', 7, 7], ['J', 8, 11]),
        front: ['OOGSSGOO', 'OOGGGGOO', 'OOGGGGOO', 'ooGGGGoo', 'OOGGGGOO', 'OOGGGGOO', 'ooGGGGoo', 'BBBBBBBB', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ', 'JJJJJJJJ'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['G', 0, 7], ['S', 8, 8], ['T', 9, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['J', 0, 4], ['j', 5, 5], ['J', 6, 8], ['B', 9, 11]) });
    },
  },
  {
    id: 'hoodie',
    palette: { H: '#3aa65b', h: '#2d8547', D: '#f0f0f0', S: '#e3b48c', s: '#c99670', E: '#3b6ea5', W: '#ffffff', K: '#4a2f1b', P: '#2b2b33', T: '#f4f4f4', t: '#d33a3a' },
    draw({ paint }) {
      paint('head', {
        all: rows(['K', 0, 2], ['S', 3, 7]),
        top: 'K',
        back: 'K',
        front: ['KKKKKKKK', 'KKKKKKKK', 'KSSKSSSK', 'SSSSSSSS', 'SWESSEWS', 'SSSSSSSS', 'SSssssSS', 'SSSSSSSS'],
      });
      // Kapüşon: şapka katmanında üstü, yanları ve arkayı sarar, yüzü açık bırakır.
      paint('hat', {
        all: 'H',
        bottom: null,
        front: ['HHHHHHHH', 'H......H', 'H......H', 'H......H', 'H......H', 'H......H', 'H......H', 'H......H'],
      });
      paint('body', {
        all: rows(['H', 0, 8], ['h', 9, 9], ['P', 10, 11]),
        front: ['HHHHHHHH', 'HHDHHDHH', 'HHDHHDHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HhhhhhhH', 'HhHHHHhH', 'HhhhhhhH', 'hhhhhhhh', 'PPPPPPPP', 'PPPPPPPP'],
      });
      for (const arm of ['rarm', 'larm']) paint(arm, { all: rows(['H', 0, 9], ['h', 10, 10], ['S', 11, 11]) });
      for (const leg of ['rleg', 'lleg']) paint(leg, { all: rows(['P', 0, 9], ['T', 10, 10], ['t', 11, 11]) });
    },
  },
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  SKINS.forEach((skin, index) => {
    const canvas = createSkin(skin.palette, index + 1);
    skin.draw(canvas);
    const file = path.join(OUT_DIR, `${skin.id}.png`);
    fs.writeFileSync(file, encodePng(64, 64, canvas.rgba));
    console.log(`yazıldı: ${path.relative(process.cwd(), file)}`);
  });
}

if (require.main === module) main();

module.exports = { SKINS };
