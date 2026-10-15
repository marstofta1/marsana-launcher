'use strict';

// server/datapacks/marsana-lobby → dist/marsana-lobby.zip (Aternos'a yüklemek için).
// Zip girdileri "/" ile yazılır; Minecraft ters bölü içeren zip'leri okuyamaz.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const root = path.join(__dirname, '..');
const src = path.join(root, 'server', 'datapacks', 'marsana-lobby');
const out = path.join(root, 'dist', 'marsana-lobby.zip');

const zip = new AdmZip();
(function add(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) add(full);
    else zip.addFile(path.relative(src, full).split(path.sep).join('/'), fs.readFileSync(full));
  }
})(src);

fs.mkdirSync(path.dirname(out), { recursive: true });
zip.writeZip(out);
console.log(`[lobby] ${path.relative(root, out)} hazır (${zip.getEntries().length} dosya)`);
