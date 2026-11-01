---
name: marsana-release
description: |
  Marsana Launcher'ın yeni sürümünü yayınlama akışı (sürüm numarası, Windows kurucusu,
  docs/downloads manifestleri, #guncellemeler notu, verify:release, push, CI'nin Mac/Linux
  Release'i). Use when the user asks to release / publish a new launcher version
  ("yeni sürüm çıkar", "sürüm olarak yayınla", "release"), or before touching
  docs/downloads, latest.yml or the version fields. Genel electron-builder bilgisi için
  electron-builder skill'i; bu skill projenin kendi adımlarıdır.
---

# Marsana Launcher sürüm yayınlama

Windows dağıtımı GitHub Pages'tan (`docs/downloads`) yapılır; electron-updater `latest.yml`'i
oradan okur. Mac/Linux paketlerini CI (`.github/workflows/build-desktop.yml`) derler ve
`v<sürüm>` GitHub Release'ine yükler. Örnek: `git show fe2d3c3 --stat`, `git show 6f90164 --stat`.

## Önemli: main'e push = yayın

`src/**`, `package.json` vb. değişen her push `build-desktop.yml`'i tetikler ve Mac/Linux
paketlerini **package.json'daki mevcut sürüm numarasının** Release'ine yükler (make_latest).
Sürüm çıkarmadan push'lamak, mevcut sürümün Mac/Linux dosyalarını sessizce değiştirir —
kullanıcıya bunu söylemeden push'lama.

## Adımlar

1. **Sürüm numarası** (patch artır, ör. 1.0.54 → 1.0.55) — üç yer:
   - `package.json`: `version` ve `displayVersion`
   - `package-lock.json`: ilk iki `"version"` (kök + `packages[""]`)
   - `src/renderer/index.html`: `<small class="app-version">vX.Y.Z</small>`
2. **Güncellemeler notu** — `docs/index.html` içindeki `<ol class="changelog">`:
   en üste yeni `<li class="release">` ekle, `<span class="release-tag latest">Yeni</span>`
   etiketini yeni sürüme taşı (eski girişten sil). Türkçe, kullanıcıya dönük, kısa
   `<li><strong>Başlık.</strong> açıklama</li>` maddeleri. Yalnız launcher'a gelen değişiklikleri yaz
   (sunucu datapack'i zaten canlıdır).
3. **Testler**: `npm test`
4. **Windows kurucusu**: `npm run pack:win` (birkaç dakika; çıktıyı bir log dosyasına yönlendir).
   Kurucuyu `docs/downloads`'a taşır, `latest.yml` + `windows-manifest.json`'u günceller,
   eski sürümün `.exe`/`.blockmap`'ini budar. İmza yok (beklenen: "signing is skipped").
5. **Mac/Linux manifestleri** elle: `docs/downloads/macos-manifest.json` ve
   `linux-manifest.json` içinde eski sürüm numarasını yenisiyle değiştir (yalnız sayılar değişir;
   URL'ler CI'nin oluşturacağı `releases/download/vX.Y.Z/...` Release'ini gösterir).
6. **Doğrula**: `npm run verify:release` → "Release doğrulaması OK (vX.Y.Z)" olmalı.
   `grep -c <eski sürüm> docs/downloads/*.json docs/downloads/latest.yml` hep 0 olmalı.
7. **Commit** — mesaj kalıbı:
   ```
   Surum vX.Y.Z — <kısa başlık>

   <değişikliklerin özeti>

   Windows kurucusu docs/downloads'a alindi, latest.yml + manifestler X.Y.Z,
   eski <önceki> budandi. #guncellemeler sayfasina giris eklendi.

   Testler: unit + verify yesil. verify:release OK (vX.Y.Z).
   ```
   `git add` ile yalnız: `package.json package-lock.json src/renderer/index.html docs`
   (+ sürümle gelen kod commit'leri zaten ayrı olabilir).
8. **Push** `main` (kullanıcı sürüm istediyse onaylıdır). Sonra `gh run list --limit 4`:
   "Deploy GitHub Pages" (Windows güncellemesi canlı) ve "Build macOS and Linux packages"
   (~8 dk, v<sürüm> Release'ini oluşturur) başlamalı. CI'yi poll etme; kullanıcıya
   Mac/Linux linklerinin CI bitene kadar çalışmayacağını söyle.

## Sürüm çıkarmadan "sessiz" yayın

Launcher'da uzaktan ayar yok; kod değişikliği ancak yeni sürümle kullanıcıya ulaşır.
"Sürüm çıkarmadan yayınla" istenirse bunu açıkla ve seçenek sun (yalnız commit / push /
yama sürümü) — yukarıdaki push uyarısıyla birlikte.
