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

**Sunucu geneli:** TNT patlamaları kapalı (ateşlenen TNT ve TNT'li vagon patlamadan silinir; 1.21.1'de
`tntExplodes` gamerule'u yok) ve ateş yayılmaz (`gamerule doFireTick false`, datapack yüklenince ayarlanır).
Sohbete komut bloğu çıktısı, "oyun modun değişti" gibi komut geri bildirimleri ve op'lara giden "[Server: ...]"
kayıtları düşmez (`commandBlockOutput`, `sendCommandFeedback`, `logAdminCommands` kapalı); op'lar da kendi
komutlarının onay mesajını görmez, hatalar yine görünür.
Creeper'ların patlama yarıçapı 0'dır. End Crystal, End dışında ve End'de ejderha adası (merkezden 200 blok)
dışında koyulursa silinir ve eşyası geri düşer. Yatak ve diriltici (respawn anchor) hiçbir boyutta patlamaz:
`data/minecraft/dimension_type` her boyutta `bed_works` ve `respawn_anchor_works` değerini açar, ikisi de doğma
noktası olur. Boyut tipleri yalnızca sunucu açılırken okunur, bu kısım için `reload` yetmez, **yeniden başlat**.

### Kurulum (Aternos)

1. `npm run pack:lobby` komutunu çalıştır, `dist/marsana-lobby.zip` oluşur.
2. Aternos'ta **Dosyalar → world → datapacks** klasörüne zip'i yükle ve sunucuyu yeniden başlat.
3. Oyunda op olarak lobinin merkezi olacak yerde, zeminde dur:
   `/function marsana_lobby:build`
   97x97 blokluk alan temizlenir; lobiyi düz bir yere kur.
4. Eski (33x33) lobisi olan sunucuda yalnızca genişletmeyi kurmak için lobinin ortasında dur:
   `/function marsana_lobby:expand`
   İç lobiye ve süslemelerine dokunmaz; dört kapıdan dış kapılara yollar, KD'de etkinlik alanı,
   KB'de parkur (bitirene duyuru, başlangıca ışınlanır; parkurdayken yere ya da çite düşen başa döner), güneyde iki bahçe ekler.
5. Tavan için yine ortada dur: `/function marsana_lobby:tavan` (14 blok yukarıda cam + andezit kiriş
   tavan; dış duvarlar tavana kadar yükselir, altındaki hiçbir şeye dokunmaz).

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
| `/function marsana_lobby:npc/warps` | Warps | Adminin ayarladığı warp noktalarını tıklanabilir liste olarak gösterir, tıklayan oraya ışınlanır |
| `/function marsana_lobby:npc/end` | End | End lobisine (ana adanın ortası, 0.5 62 -3.5) ışınlar |
| `/function marsana_lobby:npc/endcity` | End City | End lobisine konur; kayıtlı End City'nin (varsayılan -576 -928, 0 0'a en yakını) 10 blok çevresinde güvenli bir yere ışınlar. Değiştirmek için op: `/function marsana_lobby:npc/endcity_ayarla {x:..,z:..}` (koordinat: `execute in minecraft:the_end run locate structure minecraft:end_city`) |
| `/function marsana_lobby:npc/nether` | Nether | Nether'da 0 0 çevresinde 5000 blok içinde rastgele güvenli bir yere ışınlar (y 120 altı, lav/ateş üstü değil) |
| `/function marsana_lobby:npc/rtp` | Rastgele Işınlan | Create dünyasında 0 0 çevresinde 5000 blok içinde rastgele güvenli bir yere ışınlar; Create Dünyası NPC'sinden farklı olarak kayıtlı konuma değil, her seferinde yeni bir yere |
| `/function marsana_lobby:npc/duz` | Create Dünyası 2 | Create dünyasından ayrı düz dünya boyutuna (`marsana_lobby:duz2`) ışınlar; orada kaldığı yer varsa oraya, yoksa ortasına (0.5 64 0.5; zemin ufuk yüksekliği 63 altında olursa gökyüzü gündüz de kararır). Oradaki konum ayrı tutulur, Create Dünyası NPC'si oraya göndermez. Yeni boyut yalnızca açılışta okunur: zip'i yükleyince sunucuyu **yeniden başlat** |
| `/function marsana_lobby:npc/donus` | Lobiye Dön | Ana lobinin ortasına ışınlar (`/trigger lobi` gibi); End lobisi gibi uzak yerler için |
| `/function marsana_lobby:npc/trash` | Çöp | Elde tutulan eşyayı (tüm yığını) siler; 1,5 blok yakınına atılan eşyalar da saniyede bir silinir |
| `/function marsana_lobby:npc/shop` | Shop | Marsanaty ile alışveriş: komut bloğu (300), bariyer (1000), tek seferde 1 adet; Moderatör rankı (7000) |

NPC kaldırmak için yanında dur: `/function marsana_lobby:npc/remove`. Yeni NPC türü eklemek için
`npc/place`'i yeni bir `kind` ile çağıran bir fonksiyon, `advancement/npc/<kind>.json` ve
`npc/click_<kind>.mcfunction` ekle.

### Işınlanma Menüsü eşyası

Herkesin envanterinde parlayan bir **Işınlanma Menüsü** (Create üretim planı, `create:crafting_blueprint`, `custom_data` `marsana_menu`) durur.
Elde tutup sağ tıklayınca sohbette tıklanabilir menü çıkar: Create Dünyası, Create Dünyası 2, Nether, End, End City, Lobi
(`/trigger isinlan set 1..6`, NPC'lerle aynı ışınlamalar). Atılan kopya silinir, envanterde tam bir tane olmazsa
(atıldı, sandığa kondu, çoğaltıldı) yenisi verilir; sol ele konamaz. Envanter doluysa verilemez.

Sağ tık algılama: eşyayı tutan oyuncunun gözünün 0,6 blok önünde görünmez bir tıklama kutusu (interaction)
durur, sağ tık bloğa değil kutuya gider (`menu/tick`, `advancement/menu.json`). Eşya elde iken blok kırılamaz/
koyulamaz. Kutu hızlı harekette geride kalıp eşya duvara plan olarak asılırsa o plan silinir ve menü yine açılır.
Görünümü değiştirmek için `menu/` ve `predicate/menu_*.json` içindeki `create:crafting_blueprint`'i ve `marsana_lobby.plan` sayacının ölçütünü değiştir.

### Marsanaty (oyun içi para)

Gerçek parayla satılmaz, yalnızca etkinliklerden kazanılır. Etkinliği op başlatır ve ödülü verir:

| Komut (op) | Ne yapar |
|---|---|
| `/function marsana_lobby:para/ver {oyuncu:"isim",miktar:100}` | Bir oyuncuya verir, herkese duyurur (çevrimdışı oyuncuya da) |
| `/function marsana_lobby:para/herkese {miktar:50}` | Çevrimiçi herkese verir, duyurur |
| `/function marsana_lobby:para/al {oyuncu:"isim",miktar:100}` | Yanlış verileni geri alır |

Bakiye Shop ve Profil NPC'lerinde görünür. Fiyatlar `shop/menu.mcfunction` ve
`shop/buy_*.mcfunction` içinde. Komut bloğunu yalnızca op'lar yere koyabilir; bu menüde yazıyor.

### Warplar

Op, warp olacak yerde bakılacak yöne dönerek: `/function marsana_lobby:warp/ayarla {ad:"Parkur"}`
(aynı isim varsa yeri güncellenir). Silmek için: `/function marsana_lobby:warp/sil {ad:"Parkur"}`.
Warplar her boyutta olabilir; Warps köylüsü hepsini listeler.

### Ranklar

Herkes **[Oyuncu]**, Shop'tan 7000 Marsanaty'ye alınan **[Moderatör]** (`marsana.rank.mod` etiketi). Ön ek sohbette ve TAB listesinde ismin önünde görünür; ek yetki vermez. Op komutları (oyuncu çevrimiçi olmalı):

| Komut (op) | Ne yapar |
|---|---|
| `/function marsana_lobby:rank/ver {oyuncu:"isim"}` | Moderatör rankını parasız verir |
| `/function marsana_lobby:rank/al {oyuncu:"isim"}` | Moderatör rankını geri alır (para iade edilmez) |

### End lobisi

End ana adasının ortasında (0 62 0) elle kurulmuş bina ikinci korumalı alandır: x -14..14, y 52..82, z -14..14
(`tick.mcfunction`, `mobs.mcfunction` ve `save_pos_force.mcfunction` içinde; değiştirirsen üçünü birlikte güncelle).
End NPC'si `0.5 62 -3.5`'e, güneye bakarak ışınlar (`npc/click_end.mcfunction`).
Ana lobiden farkı: **adminler de** macera moduna alınır, kimse blok kıramaz (creative'e geçen admin bir sonraki
tick'te geri döner; "claim'li" mesajını adminler de görür). Düzenlemek için alanın dışından `/fill`, `/setblock`
gibi komutlar kullanılabilir. Diğer kurallar ana lobideki gibi: hasar almaz, düşman yaratıklar
(Enderman dahil, ejderha hariç) temizlenir. Dışarı çıkan creative'e geçer. Buradaki konum Create Dünyası NPC'si
için kaydedilmez.

**Dikkat:** 0 0, vanilla'da End çıkış portalının (bedrock çeşme) yeridir. Ejderha her öldüğünde (yeniden çağrılan
ejderha dahil) oyun çeşmeyi buraya yeniden kurar ve binanın ortasındaki blokların üstüne yazar. Ejderha da çeşmenin
üstüne konar.

### Lobi boyutu (Create dünyasından ayrı)

Datapack boş bir `marsana_lobby:lobi` boyutu ekler. Lobi orada durursa Create dünyasında yürüyerek,
uçarak ya da hava gemisiyle bulunamaz; yalnızca girişte, `/trigger lobi` ile ve lobideki warplarla
gidilir. Lobi boyutunda lobi alanının dışına çıkan (boşluğa düşen) oyuncu merkeze döner. Ölüp yatak
veya diriltici noktası olmadan doğan oyuncu lobiye ışınlanır. Dünya doğuş noktası Create dünyasında,
eski lobinin yerinde kalır (oyuncu oradan hemen lobiye alınır).

Spawn'da kurulu bir lobiyi taşımak için (bir kez):

1. Yeni zip'i yükle ve sunucuyu **yeniden başlat** (yeni boyut yalnızca açılışta okunur, `reload` yetmez).
2. Op olarak: `/function marsana_lobby:tasi` — bloklar (merkezden ±49, -6..+30), NPC'ler, merkez ve
   lobinin içindeki warplar aynı koordinatlarla lobi boyutuna geçer; o an lobide olanlar yeni lobiye ışınlanır.
3. `/trigger lobi` ile yeni lobiyi kontrol et.
4. Spawn'daki eski binayı kaldır: `/function marsana_lobby:eski_sil` (üstü hava, zemin çimen olur; geri alınamaz,
   lobi taşınmadan çalışmaz).

**Kaybolan chunk'lar:** Lobi boyutunda bir chunk tamamen boş kalırsa (zeminden tavana boşluk, altında boşluk)
op olarak `/function marsana_lobby:onar` çalıştır. 1024 blok doğuda geçici, temiz bir lobi kurulur; temel katmanı
(merkezin 6 altı) boş olan chunk'lar ondan geri alınır, sağlam chunk'lara dokunulmaz, kopya silinir. Kaybolan
chunk'lardaki NPC'ler ve elle yapılmış değişiklikler geri gelmez.

Yeni kurulumda lobi doğrudan lobi boyutunda da kurulabilir, ama boş boyutta durulacak zemin olmadığı için
önce taşıma yolu daha kolaydır.

### Klima SMP yan menüsü

Ekranın sağında herkese açık bir menü durur: başlık **KLIMA SMP**, altında Türkiye saati
(`Saat (TR): 14:30`), ardından çevrimiçi oyuncuların adları ve sağlarında Marsanaty bakiyeleri
(en zenginden aşağı, en fazla 12 oyuncu). Menü saniyede bir yenilenir.

Datapack gerçek saati okuyamaz; saat oyun tick'leriyle ilerler. Bu yüzden:

- Sunucu her açıldığında (ve `/reload` sonrası) saat `--:--` görünür. Op olarak ayarla:
  `/function marsana_lobby:saat/ayarla {saat:14,dakika:30}` (Türkiye saati, 24 saat).
- Sunucu çok kasarsa (20 TPS altı) saat yavaş kalabilir; gerekirse yeniden ayarla.

### Kaldırma

Önce `/function marsana_lobby:uninstall` (çevrimiçi oyuncuların macera modunu geri alır), sonra
zip'i sil. Bina yerinde kalır.

### Binayı değiştirmek

`structure.mcfunction` elle düzenlenmez, üretilir:

```
node scripts/gen-lobby-structure.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/structure.mcfunction
node scripts/gen-lobby-expansion.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/expansion.mcfunction
node scripts/gen-lobby-roof.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/roof.mcfunction
```
