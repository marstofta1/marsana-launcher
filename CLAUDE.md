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
| Paketleme, `electron-builder`, kod imzalama, NSIS/DMG, `electron-updater`, `pack:*` script'leri | `electron-builder` |
| Yeni launcher sürümü yayınlama, `docs/downloads`, `latest.yml`, sürüm numarası, `#guncellemeler` notu, main'e push | `marsana-release` (+ `electron-builder`) |

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

## Oturum sağlığı — kullanıcı istemeden öner

Proje ve oturum sağlığı için, uygun anda `/compact`, `/clear` veya yeni oturum açmayı **kendin öner**:

- Oturum uzadıysa ve aynı iş sürüyorsa → `/compact`.
- Bir iş bitti ve ilgisiz yeni bir işe geçiliyorsa → `/clear` veya yeni oturum.
- Bağlam eski/çelişkili bilgiyle dolduysa ya da ortam değişikliği (kurulum, PATH, MCP ayarı)
  yeniden başlatma gerektiriyorsa → yeni oturum.

Öneriyi tek satırla ve işin doğal bir durak noktasında yap; yarım kalmış işi bölme.

## Launcher'ı Claude ile doğrulama (MCP)

`.mcp.json`'daki `launcher-devtools` (Google'ın resmi `chrome-devtools-mcp`'si, sürümü sabit)
çalışan launcher'ın arayüzüne bağlanır: sayfa okuma, tıklama, konsol, ağ, ekran görüntüsü.
Önce launcher'ı `npm run start:debug` ile (arka planda) aç; bu, yalnız paketsiz geliştirme
sürümünde 127.0.0.1:9222 hata ayıklama portunu açar. `chrome-devtools` girişi ise ayrı bir
Chrome açar (web sayfaları için). MCP sürümünü güncellerken `@latest` yerine yine sabit sürüm yaz.

## Skill dosyaları

Skill'ler `.claude/skills/<ad>/SKILL.md` altında **gerçek dosya** olarak depoya dahildir;
her klonda kurulum gerektirmeden yüklenir. Junction/symlink kullanma — makineye özel mutlak
yol tutar, git'e girmez ve yeni makinede skill'ler sessizce kaybolur.

Kaynak ve sürüm bilgisi `skills-lock.json` içinde tutulur. Bir skill'i kaynağından güncellemek
için yeni `SKILL.md`'yi (ve `references/`'ı) ilgili klasöre doğrudan kopyala, farkı gözden geçirip
commit'le; projeye özel düzeltmeleri (sürüm gerçekleri vb.) korumak için körü körüne üzerine yazma.
