#!/usr/bin/env node
// Lobi claim sunucu modunu (server/mods/marsana-lobby-claim) Gradle'sız derler.
// Kullanım: node scripts/build-lobby-claim-mod.js <NeoForge 1.21.1 sunucusunun libraries klasörü> [JDK 21 bin klasörü]
// Çıktı: dist/marsana-lobby-claim-1.0.0.jar
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const libs = process.argv[2];
const jdkBin = process.argv[3] || '';
if (!libs || !fs.existsSync(libs)) {
  console.error('Kullanım: node scripts/build-lobby-claim-mod.js <libraries klasörü> [JDK 21 bin]');
  process.exit(1);
}
const tool = (name) => (jdkBin ? path.join(jdkBin, name) : name);

const jars = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.jar')) jars.push(p);
  }
})(libs);
// Yamalı Minecraft sınıfları (neoforge-*-server.jar) tam sunucu jar'ından önce gelmeli.
jars.sort((a, b) => (/neoforge-[^\/]*-server\.jar$/.test(b) ? 1 : 0) - (/neoforge-[^\/]*-server\.jar$/.test(a) ? 1 : 0));

const root = path.join(__dirname, '..', 'server', 'mods', 'marsana-lobby-claim');
const src = path.join(root, 'src', 'main');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lobby-claim-'));
const javaFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.java')) javaFiles.push(p);
  }
})(path.join(src, 'java'));

execFileSync(tool('javac'), ['--release', '21', '-encoding', 'UTF-8', '-proc:none', '-nowarn',
  '-cp', jars.join(path.delimiter), '-d', out, ...javaFiles], { stdio: 'inherit' });
fs.cpSync(path.join(src, 'resources'), out, { recursive: true });

const distDir = path.join(__dirname, '..', 'dist');
fs.mkdirSync(distDir, { recursive: true });
const jarPath = path.join(distDir, 'marsana-lobby-claim-1.0.0.jar');
fs.rmSync(jarPath, { force: true });
execFileSync(tool('jar'), ['cf', jarPath, '-C', out, '.'], { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true });
console.log(`[lobby-claim] ${path.relative(process.cwd(), jarPath)} hazır`);
