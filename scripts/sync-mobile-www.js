'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'docs', 'mobile');
const outDir = path.join(root, 'mobile-app', 'www');
const logoSrc = path.join(root, 'docs', 'assets', 'logo.png');
const logoDst = path.join(outDir, 'assets', 'logo.png');

const copyFiles = ['app.js', 'style.css', 'servers.json'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function buildIndexHtml() {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#4caf50" />
  <meta name="description" content="Marsana Launcher Mobile — telefonda Minecraft Bedrock başlatıcı." />
  <title>Marsana Launcher</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <header class="header">
      <img src="assets/logo.png" width="48" height="48" alt="" aria-hidden="true" />
      <div>
        <h1>Marsana Launcher</h1>
        <p>Mobil sürüm · yalnızca Bedrock</p>
        <span class="badge">ANDROID UYGULAMASI</span>
      </div>
    </header>

    <section class="play-card" aria-label="Minecraft Bedrock başlat">
      <h2>Minecraft Bedrock</h2>
      <p>
        Bu launcher yalnızca <strong>Minecraft Bedrock</strong> uygulamasını açar.
        Java Edition, modlar ve shader desteklenmez.
      </p>
      <button type="button" class="btn-play" id="play-btn">OYNA</button>
      <p class="status" id="status" aria-live="polite"></p>
      <p class="hint" id="play-hint">
        Minecraft yüklü değilse Play Store açılır. Oyuna girdikten sonra Microsoft hesabınla giriş yap.
      </p>
    </section>

    <section aria-label="Önerilen sunucular">
      <h2 class="section-title">Önerilen Sunucular</h2>
      <div class="server-list" id="server-list">
        <p class="hint">Sunucular yükleniyor…</p>
      </div>
    </section>

    <footer class="footer">
      <p>Marsana Launcher Mobile · Bedrock başlatıcı</p>
    </footer>
  </div>

  <script src="app.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

ensureDir(outDir);
for (const name of copyFiles) {
  copyFile(path.join(srcDir, name), path.join(outDir, name));
}
copyFile(logoSrc, logoDst);
buildIndexHtml();

console.log('mobile-app/www senkronize edildi.');
