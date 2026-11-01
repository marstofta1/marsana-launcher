---
name: klima-sunucu
description: |
  Klima SMP resmi sunucusu (Aternos, NeoForge 1.21.1 + Create) ile çalışma akışı: lobi
  datapack'ini paketleme, Aternos'a yükletme, reload/restart kararı, Aternos konsolundan komut
  çalıştırıp çıktı okuma, sunucu modlarıyla launcher'ın Klima SMP paketini senkron tutma.
  Use when: server/datapacks/** değişti ve sunucuya gidecek, kullanıcı "yükledim", "reload yap",
  "konsoldan bak", Aternos, Klima SMP, sunucu modu ekleme/güncelleme, src/shared/marsanaServer.js.
  Datapack sözdizimi için minecraft-datapack skill'i; bu skill sunucuya teslim ve doğrulamadır.
---

# Klima SMP sunucusu

- Sunucu: Aternos, `marstral11880-OSWR.aternos.me`, NeoForge 1.21.1, Create 6.0.10 + Aeronautics
  + Diesel Generators + Login System (yalnız sunucu). Cracked, oyuncular lobi dışında creative.
- Lobi datapack'i: `server/datapacks/marsana-lobby` (namespace `marsana_lobby`, pack_format 48).
  Özellik listesi ve NPC tablosu: `server/datapacks/README.md` — her özellikte güncelle.
- Sohbet öneki `[Klima]`. Admin etiketi `marsana.admin`. Geçici skorlar `marsana_lobby.calc`.

## Teslim akışı (datapack değişikliği)

1. Değişikliği yap, README'yi güncelle, commit'le (push'lama — sunucu dosyası git'ten okunmaz).
2. `npm run pack:lobby` → `dist/marsana-lobby.zip`. Boyutu kB olarak hesapla
   (`bayt / 1024`, 2 ondalık; Aternos böyle gösterir) ve kullanıcıya söyle.
3. **Yüklemeyi kullanıcı yapar** — Claude built-in browser'dan dosya yükleyemez. Hedef:
   Aternos → Dosyalar → `world/datapacks`. Aynı adlı zip'in üzerine yazma bazen gerçekleşmez:
   kB değişmediyse kullanıcıdan **önce eski zip'i silmesini**, sonra yüklemesini iste.
   Aternos'ta dosya silme işini Claude yapmaz; kullanıcı yapar.
4. Doğrula: built-in browser'da `https://aternos.org/files/world/datapacks` aç, zip'in kB'ını
   beklenenle karşılaştır.
5. **reload mı restart mı:**
   - Fonksiyon / advancement / predicate / loot table / tag → `reload` yeter.
   - Yeni **dimension** (`data/<ns>/dimension/*.json`) veya dimension_type → sunucu **yeniden
     başlatılmalı**; reload yetmez. Başlatmayı (reklamlı) kullanıcı yapar.
6. Gerekirse oyunda yerleştirme komutunu ver (ör. NPC: `/function marsana_lobby:npc/<tür>`).

## Aternos konsolu

- `https://aternos.org/console/` — komut kutusu: `find` ile "textbox" ara, ref'ine yaz, Enter.
- Komutlar `/` olmadan yazılır (`reload`, `function marsana_lobby:...`, `execute ...`).
- Çıktıyı okumak: `javascript_tool` ile `document.querySelector('main').innerText`, sonundaki
  "Enable cheats" yardım metninden önceki son satırlar. Datapack yükleme hataları reload'dan
  hemen sonra burada görünür. Diesel Generators loot table hatası bilinen, datapack'le ilgisiz.
- Advancement sayısının reload sonrası artması yeni advancement'ın yüklendiğini doğrular.
- Sunucu kapalıysa konsol çalışmaz; başlatmayı kullanıcıdan iste.

## Sunucu modu eklerken / güncellerken

NeoForge'da istemci ve sunucu kayıtları birebir aynı olmalı, yoksa bağlantı reddedilir.
- Sunucuya Aternos'tan (Modrinth kaynağı) kur; aynı **sürümü** `src/shared/marsanaServer.js`
  `MARSANA_SERVER_PINNED_MODS`'a ekle (slug, versionId, file, url, sha512 — Modrinth API'den).
- Launcher değişikliği ancak yeni sürümle oyunculara ulaşır → `marsana-release` skill'i.
- Tek oyunculu "Create (+ eklentiler)" paketi ayrıdır (`CREATE_ADDON_SLUGS`,
  `src/core/mods/shaderStackService.js`); sunucuyu etkilemez.
