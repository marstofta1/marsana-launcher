# Kullanım (op): lobi kurulduktan sonra, lobinin ortasında durarak "/function marsana_lobby:expand".
# Lobiyi 97x97'ye genişletir; mevcut 33x33 lobiye ve içindeki süslemelere dokunmaz.
# Alan yüklü olmalı: lobinin ortasında dur. Birkaç saniye takılma olabilir.
execute unless entity @e[type=minecraft:marker,tag=marsana_lobby.center] run return run tellraw @s {"text":"[Klima] Önce lobiyi kur: /function marsana_lobby:build","color":"red"}
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run function marsana_lobby:expansion
tellraw @s {"text":"[Klima] Lobi 97x97'ye genişletildi: etkinlik alanı (KD), parkur (KB), bahçeler (G).","color":"green"}
