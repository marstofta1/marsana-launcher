'use strict';

// Minecraft skin'leri için küçük, bağımlılıksız PNG kodlayıcı/çözücü.
// Yalnız 8 bit RGBA / RGB / paletli (tRNS'li) taramasız PNG'leri çözer — skin
// dosyalarının neredeyse tamamı bu biçimdedir. Kodlayıcı her zaman 8 bit RGBA yazar.

const zlib = require('zlib');

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/** rgba: width*height*4 baytlık Uint8Array/Buffer. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function readPngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24 || !buf.subarray(0, 8).equals(SIGNATURE)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** PNG'yi { width, height, rgba } olarak çözer; desteklenmeyen biçimde hata fırlatır. */
function decodePng(buf) {
  const size = readPngSize(buf);
  if (!size) throw new Error('Geçerli bir PNG dosyası değil.');
  let offset = 8;
  let header = null;
  let palette = null;
  let trns = null;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!header) throw new Error('PNG başlığı bulunamadı.');
  const { width, height, bitDepth, colorType, interlace } = header;
  const channels = { 6: 4, 2: 3, 3: 1 }[colorType];
  if (bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error('Bu PNG biçimi desteklenmiyor (8 bit RGBA/RGB/paletli olmalı).');
  }
  if (colorType === 3 && !palette) throw new Error('Paletli PNG\'de palet eksik.');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error('PNG verisi eksik.');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? pixels[dst + x - channels] : 0;
      const b = y > 0 ? pixels[dst - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[dst - stride + x - channels] : 0;
      const v = raw[src + x];
      let out;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) out = v + paeth(a, b, c);
      else throw new Error('PNG filtre türü geçersiz.');
      pixels[dst + x] = out & 0xff;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    if (colorType === 6) {
      pixels.copy(rgba, i * 4, i * 4, i * 4 + 4);
    } else if (colorType === 2) {
      rgba[i * 4] = pixels[i * 3];
      rgba[i * 4 + 1] = pixels[i * 3 + 1];
      rgba[i * 4 + 2] = pixels[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    } else {
      const idx = pixels[i];
      rgba[i * 4] = palette[idx * 3] || 0;
      rgba[i * 4 + 1] = palette[idx * 3 + 1] || 0;
      rgba[i * 4 + 2] = palette[idx * 3 + 2] || 0;
      rgba[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, rgba };
}

module.exports = { encodePng, decodePng, readPngSize };
