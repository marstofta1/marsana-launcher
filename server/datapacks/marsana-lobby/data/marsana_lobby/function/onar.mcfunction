# Kullanım (op): "/function marsana_lobby:onar"
# Lobi boyutunda kaybolmuş (tamamen boş kalmış) lobi chunk'larını onarır. 1024 blok doğuda geçici, temiz bir lobi
# kurar; lobi alanındaki her chunk'ın temel katmanı (merkezin 6 altı) iki köşede de havaysa o chunk'ı bu kopyadan
# geri alır. Sağlam chunk'lara dokunmaz. Kaybolan chunk'lardaki NPC'ler ve elle yapılan değişiklikler geri gelmez.
execute unless entity @e[type=minecraft:marker,tag=marsana_lobby.center] run return run tellraw @s {"text":"[Marsana] Lobi merkezi bulunamadı.","color":"red"}
execute as @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] at @s unless dimension marsana_lobby:lobi run return run tellraw @s {"text":"[Marsana] Onarım yalnızca lobi boyutundaki lobi için.","color":"red"}
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload add ~-49 ~-49 ~49 ~49
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run forceload add ~-49 ~-49 ~49 ~49
schedule function marsana_lobby:onar/kur 40t replace
tellraw @s {"text":"[Marsana] Lobi onarılıyor (birkaç saniye)...","color":"yellow"}
