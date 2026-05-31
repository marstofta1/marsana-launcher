'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const depsDir = path.join(root, 'bundled-mods', 'deps');
const CLOTH_CONFIG = {
  filename: 'cloth-config-26.1.154.jar',
  url: 'https://cdn.modrinth.com/data/9s6osm5g/versions/GFM8zh9J/cloth-config-26.1.154.jar',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        try {
          file.close();
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        reject(err);
      });
  });
}

async function main() {
  fs.mkdirSync(depsDir, { recursive: true });
  const dest = path.join(depsDir, CLOTH_CONFIG.filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100_000) {
    console.log(`[deps] Hazir: ${CLOTH_CONFIG.filename}`);
    return;
  }
  console.log(`[deps] Indiriliyor: ${CLOTH_CONFIG.filename}`);
  await download(CLOTH_CONFIG.url, dest);
  console.log(`[deps] Kaydedildi: ${path.relative(root, dest)}`);
}

main().catch((err) => {
  console.error('[deps] Hata:', err.message);
  process.exit(1);
});
