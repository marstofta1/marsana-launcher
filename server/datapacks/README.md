# Sunucu datapack'leri

## marsana-lobby — korumalı doğuş lobisi (Minecraft 1.21.1, Create gerekli)

35x35'lik Create temalı bir lobi kurar ve dünya doğuş noktasını lobinin ortasına alır. Lobi
alanında (merkezden yatayda ±20 blok) adminler hariç herkes macera moduna geçer, blok kırıp
koyamaz, hasar almaz ve acıkmaz. Lobideki düşman yaratıklar temizlenir. Lobi dışında (Create
dünyası, Nether, End) admin olmayanlar creative modundadır; girişte Login System'i bekleyenlere
dokunulmaz. Lobiden çıkan admin survival'a döner.

**Adminler** `marsana.admin` etiketiyle belirlenir (datapack op'luğu göremez):
`/tag isim add marsana.admin`, kaldırmak için `/tag isim remove marsana.admin`. Adminler lobide
her modda kalabilir ve lobiyi düzenleyebilir.

Her girişte oyuncu lobiye ışınlanır. Login System modu oyuncuyu girişte bekleme alanında tutup
`/login` sonrası son konumuna ışınladığı için lobiye ışınlama bundan sonra yapılır: oyuncu bekleme
alanından (`loginsystem.properties` içindeki `waitingAreaX/Y/Z`, varsayılan `0 100 0`) ayrıldığı an.
Bekleme alanı ayarlanırsa `join_wait.mcfunction` içindeki konumu da güncelle. Herkes
`/trigger lobi` ile istediği zaman lobiye dönebilir.

### Kurulum (Aternos)

1. `npm run pack:lobby` komutunu çalıştır, `dist/marsana-lobby.zip` oluşur.
2. Aternos'ta **Dosyalar → world → datapacks** klasörüne zip'i yükle ve sunucuyu yeniden başlat.
3. Oyunda op olarak lobinin merkezi olacak yerde, zeminde dur:
   `/function marsana_lobby:build`
   35x35x16 blokluk alan temizlenir; lobiyi düz bir yere kur.

### NPC'ler

Op olarak NPC'nin duracağı blokta, NPC'nin bakacağı yöne dönerek:

| Komut | NPC | Tıklayınca |
|---|---|---|
| `/function marsana_lobby:npc/create_world` | Create Dünyası | Lobiye gelmeden önceki konuma döner; kayıtlı konumu yoksa 300 blok içinde rastgele güvenli bir yere |
| `/function marsana_lobby:npc/profile` | Profil | Oyun süresi, ölüm, öldürülen yaratık, yürünen mesafe (lobi kurulduğundan beri) |
| `/function marsana_lobby:npc/settings` | Ayarlar | Sohbette tıklanabilir menü: girişte lobiye ışınlan, lobi bildirimleri |
| `/function marsana_lobby:npc/guide` | Nasıl Oynanır | Sohbete sunucunun kısa rehberini yazar (lobi, Create dünyası, `/trigger lobi`, Marsanaty, Shop, Çöp, Ayarlar) |
| `/function marsana_lobby:npc/rules` | Kurallar | Sohbete sunucu kurallarını yazar: Marsanaty gerçek parayla satılmaz, hile (aim bot vb.) açan ban yer, eşya çoğaltma kullanılmaz |
| `/function marsana_lobby:npc/trash` | Çöp | Elde tutulan eşyayı (tüm yığını) siler; 1,5 blok yakınına atılan eşyalar da saniyede bir silinir |
| `/function marsana_lobby:npc/shop` | Shop | Marsanaty ile alışveriş: komut bloğu (300), bariyer (1000), tek seferde 1 adet |

NPC kaldırmak için yanında dur: `/function marsana_lobby:npc/remove`. Yeni NPC türü eklemek için
`npc/place`'i yeni bir `kind` ile çağıran bir fonksiyon, `advancement/npc/<kind>.json` ve
`npc/click_<kind>.mcfunction` ekle.

### Marsanaty (oyun içi para)

Gerçek parayla satılmaz, yalnızca etkinliklerden kazanılır. Etkinliği op başlatır ve ödülü verir:

| Komut (op) | Ne yapar |
|---|---|
| `/function marsana_lobby:para/ver {oyuncu:"isim",miktar:100}` | Bir oyuncuya verir, herkese duyurur (çevrimdışı oyuncuya da) |
| `/function marsana_lobby:para/herkese {miktar:50}` | Çevrimiçi herkese verir, duyurur |
| `/function marsana_lobby:para/al {oyuncu:"isim",miktar:100}` | Yanlış verileni geri alır |

Bakiye Shop ve Profil NPC'lerinde görünür. Fiyatlar `shop/menu.mcfunction` ve
`shop/buy_*.mcfunction` içinde. Komut bloğunu yalnızca op'lar yere koyabilir; bu menüde yazıyor.

### Kaldırma

Önce `/function marsana_lobby:uninstall` (çevrimiçi oyuncuların macera modunu geri alır), sonra
zip'i sil. Bina yerinde kalır.

### Binayı değiştirmek

`structure.mcfunction` elle düzenlenmez, üretilir:

```
node scripts/gen-lobby-structure.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/structure.mcfunction
```
