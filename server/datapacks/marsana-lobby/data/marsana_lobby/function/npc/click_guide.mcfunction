advancement revoke @s only marsana_lobby:npc/guide
tellraw @s ["",{"text":"━━━━━ ","color":"dark_gray"},{"text":"Nasıl Oynanır","color":"yellow","bold":true},{"text":" ━━━━━","color":"dark_gray"}]
tellraw @s ["",{"text":" Lobi:","color":"gold","bold":true},{"text":" Burası korumalı alan. Blok kırıp koyamazsın, hasar almazsın. Köylülere sağ tıklayarak onları kullanabilirsin.","color":"gray"}]
tellraw @s ["",{"text":" Create Dünyası:","color":"gold","bold":true},{"text":" Create Dünyası köylüsü seni dünyaya götürür. Lobi dışında creative moddasın, Create ile istediğini inşa et.","color":"gray"}]
tellraw @s ["",{"text":" Lobiye dönüş:","color":"gold","bold":true},{"text":" İstediğin zaman ","color":"gray"},{"text":"/trigger lobi","color":"aqua","clickEvent":{"action":"suggest_command","value":"/trigger lobi"},"hoverEvent":{"action":"show_text","contents":"Sohbete yazmak için tıkla"}},{"text":" yaz.","color":"gray"}]
tellraw @s ["",{"text":" Marsanaty:","color":"gold","bold":true},{"text":" Oyunun parası. Etkinliklerden kazanılır, gerçek parayla satılmaz. Bakiyeni Profil köylüsünde görürsün.","color":"gray"}]
tellraw @s ["",{"text":" Shop:","color":"gold","bold":true},{"text":" Marsanaty ile özel eşyalar alırsın.","color":"gray"}]
tellraw @s ["",{"text":" Çöp:","color":"gold","bold":true},{"text":" İstemediğin eşyayı elinde tutup Çöp köylüsüne tıkla ya da yanına at. Silinen eşya geri gelmez.","color":"gray"}]
tellraw @s ["",{"text":" Ayarlar:","color":"gold","bold":true},{"text":" Girişte lobiye ışınlanmayı ve lobi bildirimlerini açıp kapatırsın.","color":"gray"}]
