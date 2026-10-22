# Kullanım (op): sunucu bu datapack sürümüyle YENİDEN BAŞLATILDIKTAN sonra bir kez
#   /function marsana_lobby:tasi
# Spawn'daki lobiyi (bloklar, NPC'ler, merkez, lobideki warplar) boş "marsana_lobby:lobi" boyutuna aynı
# koordinatlara taşır; Create dünyasından artık ulaşılamaz. Eski bina yerinde kalır, yeni lobiyi
# kontrol ettikten sonra /function marsana_lobby:eski_sil ile kaldır.
execute unless entity @e[type=minecraft:marker,tag=marsana_lobby.center] run return run tellraw @s {"text":"[Klima] Lobi merkezi bulunamadı (lobi kurulu mu?).","color":"red"}
execute as @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] at @s if dimension marsana_lobby:lobi run return run tellraw @s {"text":"[Klima] Lobi zaten lobi boyutunda.","color":"yellow"}
# Kopyalanacak alanın chunk'ları iki boyutta da yüklü olmalı; yükleme bir sonraki tick'lerde olur.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload add ~-49 ~-49 ~49 ~49
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in marsana_lobby:lobi run forceload add ~-49 ~-49 ~49 ~49
schedule function marsana_lobby:tasi/kopyala 40t replace
tellraw @s {"text":"[Klima] Lobi taşınıyor (2 saniye)...","color":"yellow"}
