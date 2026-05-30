# Marsana Client — Oyun İçi Mod

Minecraft Fabric modu: **H** tuşu ile Marsana Client menüsü (mod aç/kapa, ücretsiz kozmetik).

## Hedef sürüm

- Minecraft **26.1.x** (varsayılan Gradle profili)

## Derleme

Java **21** ve Gradle gerekir:

```bash
cd marsana-client-mod
gradle build copyToBundled
```

Çıktı: `../bundled-mods/marsana-client/marsana-client-26.1.jar`

Launcher Client modunda bu jar otomatik `mods/` klasörüne kopyalanır.

## Oyun içi

| Tuş | İşlev |
|-----|--------|
| **H** | Marsana Client menüsü |

- **Modlar:** Yüklü modları aç/kapa (`.jar` ↔ `.jar.disabled`). Değişiklik sonraki oyun başlatmasında geçerli.
- **Kozmetik:** Ücretsiz pelerin seçenekleri (yalnızca kendi ekranında görünür).

Ayar dosyası: `config/marsana-client.json`
