# Marsana Launcher — Claude Çalışma Notları

Bu depo bir **Electron tabanlı Minecraft launcher**'ıdır (`src/`), yanında iki **Fabric mod**
(`marsana-client-mod`, `marsana-schematic-farm-mod`), analiz servisi (`analytics-server`)
ve mobil uygulama (`mobile-app`) barındırır.

## Skill yönlendirme — kullanıcı istemeden uygula

Aşağıdaki tablo **zorunlu yönlendirmedir**. İş bu alanlardan birine dokunuyorsa, kullanıcının
`/skill-adi` yazmasını bekleme — ilgili skill'i **kendin çağır** ve hangisini açtığını tek satırla söyle.
Kullanıcı hangi skill'in ne zaman gerektiğini hatırlamak zorunda değil; bu tablo onun yerine hatırlıyor.

| İş bu alana dokunuyorsa | Çağrılacak skill |
|---|---|
| `marsana-client-mod/`, `marsana-schematic-farm-mod/`, mod kodu, Fabric kayıt/mixin/item/blok/entity, `fabric.mod.json`, mod `build.gradle` | `minecraft-modding` |
| Mod veya plugin testi, GameTest, MockBukkit, JUnit, mod CI | `minecraft-testing` |
| Datapack, `.mcfunction`, loot table, advancement, predicate, tag, `pack.mcmeta` | `minecraft-datapack` |
| Modpack derleme, Packwiz, KubeJS, `bundled-mods/` içeriğinin seçimi, client/server dosya ayrımı | `minecraft-modpack-authoring` |
| Paper / Spigot / Bukkit **sunucu plugini**, `plugin.yml`, listener, komut, arena/kit sistemleri | `minecraft-plugin-development` |
| Modrinth'ten mod arama, metadata çekme, JAR indirme, sürüm eşleştirme | `modrinth-api` |
| Electron main/renderer/preload kodu, IPC, pencere yönetimi, `src/` altındaki launcher mantığı | `electron-development` |
| Paketleme, `electron-builder`, kod imzalama, NSIS/DMG, `electron-updater`, sürüm yayınlama, `pack:*` script'leri | `electron-builder` |

Birden fazla satır uyuyorsa hepsini çağır (ör. mod'a özellik ekleyip test yazmak →
`minecraft-modding` + `minecraft-testing`).

Skill'in tam içeriği sadece çağrıldığı anda yüklenir — bu tabloyu okumak yükleme yapmaz,
yalnızca ne zaman yükleneceğini belirler.

## Sürüm gerçekleri — skill içeriğine körü körüne uyma

- Her iki mod da **Fabric**'tir; NeoForge/Forge değil. Aksi belirtilmedikçe Fabric kalıplarını kullan.
- Hedef Minecraft sürümleri **26.1.2** (client mod) ve **26.2** (schematic farm mod);
  Fabric Loader 0.19.x, Fabric API 0.150+ / 0.152+.
- Minecraft skill'lerinin çoğu **1.21.x** anlatır. Bir API, sınıf adı veya kayıt yolu bu depodaki
  sürümle çelişiyorsa **depodaki mevcut koda ve `gradle.properties`'e uy**, skill metnine değil.
  Emin olamadığın bir API'yi uydurma — önce mevcut kaynakta doğrula.

## Skill kurulumu (yeni makinede)

Gerçek skill dosyaları `.agents/skills/` altında ve depoya dahildir. `.claude/skills/` ise
makineye özel junction'lar içerdiği için `.gitignore`'dadır. Skill'ler görünmüyorsa yeniden oluştur:

```
npx skills experimental_install
```

Kaynak ve sürüm bilgisi `skills-lock.json` içinde tutulur.
