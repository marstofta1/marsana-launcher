# Kullanım (op): lobinin ortasında durarak "/function marsana_lobby:tavan".
# Lobinin tamamına (97x97) 14 blok yükseklikte cam tavan koyar, dış duvarları tavana kadar yükseltir.
# Tavanın altındaki hiçbir şeye (iç lobi, süslemeler, köylüler) dokunmaz.
execute unless entity @e[type=minecraft:marker,tag=marsana_lobby.center] run return run tellraw @s {"text":"[Klima] Önce lobiyi kur: /function marsana_lobby:build","color":"red"}
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] unless block ~48 ~ ~48 create:andesite_casing run return run tellraw @s {"text":"[Klima] Önce lobiyi genişlet (ortada dur): /function marsana_lobby:expand","color":"red"}
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run function marsana_lobby:roof
tellraw @s {"text":"[Klima] Lobiye tavan eklendi.","color":"green"}
