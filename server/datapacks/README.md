# Sunucu datapack'leri

## marsana-lobby — korumalı doğuş lobisi (Minecraft 1.21.1, Create gerekli)

35x35'lik Create temalı bir lobi kurar ve dünya doğuş noktasını lobinin ortasına alır. Lobi
alanında (merkezden yatayda ±20 blok) survival oyuncular otomatik olarak macera moduna geçer,
blok kırıp koyamaz, hasar almaz ve acıkmaz. Lobideki düşman yaratıklar temizlenir. Dört kapıdan
dışarı çıkan oyuncu survival moduna döner. Yaratıcı ve izleyici moddaki yöneticilere dokunulmaz.

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

### Kaldırma

Önce `/function marsana_lobby:uninstall` (çevrimiçi oyuncuların macera modunu geri alır), sonra
zip'i sil. Bina yerinde kalır.

### Binayı değiştirmek

`structure.mcfunction` elle düzenlenmez, üretilir:

```
node scripts/gen-lobby-structure.js > server/datapacks/marsana-lobby/data/marsana_lobby/function/structure.mcfunction
```
