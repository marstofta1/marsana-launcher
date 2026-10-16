# Sunucu datapack'leri

## marsana-lobby — korumalı doğuş lobisi (Minecraft 1.21.1, Create gerekli)

97x97'lik Create temalı bir lobi kurar ve dünya doğuş noktasını lobinin ortasına alır. Lobi
alanında (merkezden yatayda ±49 blok) adminler hariç herkes macera moduna geçer, blok kırıp
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

**Claim mesajı:** Lobide blok kırmaya çalışan admin olmayan oyuncuya sohbette "Burası claim'li, kıramazsın!" yazılır (en fazla 2 saniyede bir). Macera modunda oyun kırma denemesini sunucuya göndermediği için oyuncunun 3 blok içinde baktığı bloğa görünmez bir tıklama kutusu (interaction) konur; sol tık bu kutuya gider. Bu yüzden lobide bloklara sağ tık (kapı, düğme) çalışmaz; NPC'ler etkilenmez.

### Kurulum (Aternos)

1. `npm run pack:lobby` komutunu çalıştır, `dist/marsana-lobby.zip` oluşur.
2. Aternos'ta **Dosyalar → world → datapacks** klasörüne zip'i yükle ve sunucuyu yeniden başlat.
3. Oyunda op olarak lobinin merkezi olacak yerde, zeminde dur:
   `/function marsana_lobby:build`
   97x97 blokluk alan temizlenir; lobiyi düz bir yere kur.
4. Eski (33x33) lobisi olan sunucuda yalnızca genişletmeyi kurmak için lobinin ortasında dur:
   `/function marsana_lobby:expand`
   İç lobiye ve süslemelerine dokunmaz; dört kapıdan dış kapılara yollar, KD'de etkinlik alanı,
   KB'de parkur (bitirene duyuru, başlangıca ışınlanır), güneyde iki bahçe ekler.

### NPC'ler

Op olarak NPC'nin duracağı blokta, NPC'nin bakacağı yöne dönerek:

| Komut | NPC | Tıklayınca |
|---|---|---|
| `/function marsana_lobby:npc/create_world` | Create Dünyası | Lobiye gelmeden önceki konuma döner; kayıtlı konumu yoksa 300 blok içinde rastgele güvenli bir yere |
| `/function marsana_lobby:npc/profile` | Profil | Oyun süresi, ölüm, öldürülen yaratık, yürünen mesafe (lobi kurulduğundan beri) |
| `/function marsana_lobby:npc/settings` | Ayarlar | Sohbette tıklanabilir menü: girişte lobiye ışınlan, lobi bildirimleri |
| `/function marsana_lobby:npc/guide` | Nasıl Oynanır | Sohbete sunucunun kısa rehberini yazar (lobi, Create dünyası, `/trigger lobi`, Marsanaty, Shop, Çöp, Ayarlar) |
| `/function marsana_lobby:npc/rules` | Kurallar | Sohbete sunucu kurallarını yazar: Marsanaty gerçek parayla satılmaz, hile (aim bot vb.) açan ban yer, eşya çoğaltma kullanılmaz |
| `/function marsana_lobby:npc/afk` | AFK | Oyuncuyu AFK moduna alır, herkese duyurur; yarım bloktan fazla hareket edince AFK biter |
| `/function marsana_lobby:npc/trash` | Çöp | Elde tutulan eşyayı (tüm yığını) siler; 1,5 blok yakınına atılan eşyalar da saniyede bir silinir |
| `/function marsana_lobby:npc/shop` | Shop | Marsanaty ile alışveriş: komut bloğu (300), bariyer (1000), tek seferde 1 adet; Moderatör rankı (7000) |

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

### Ranklar

Herkes **[Oyuncu]**, Shop'tan 7000 Marsanaty'ye alınan **[Moderatör]** (`marsana.rank.mod` etiketi). Ön ek sohbette ve TAB listesinde ismin önünde görünür; ek yetki vermez. Op komutları (oyuncu çevrimiçi olmalı):

| Komut (op) | Ne yapar |
|---|---|
| `/function marsana_lobby:rank/ver {oyuncu:"isim"}` | Moderatör rankını parasız verir |
| `/function marsana_lobby:rank/al {oyuncu:"isim"}` | Moderatör rankını geri alır (para iade edilmez) |

### Kaldırma

Önce `/function marsana_lobby:uninstall` (çevrimiçi oyuncuların macera modunu geri alır), sonra
zip'i sil. Bina yerinde kalır.

### Binayı değiştirmek

`structure.mcfunction` elle düzenlenmez, üretilir:

```
node scripts/gen-lobby-structure.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/structure.mcfunction
node scripts/gen-lobby-expansion.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/expansion.mcfunction
```
