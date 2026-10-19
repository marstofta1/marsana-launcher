# Kullanım (op): lobi taşındıktan ve yeni lobi kontrol edildikten sonra
#   /function marsana_lobby:eski_sil
# Spawn'daki (Create dünyası) eski lobi binasını kaldırır: zemin seviyesinin üstü hava, zemin çimen,
# altı toprak olur. Geri alınamaz. Lobi henüz taşınmadıysa çalışmaz (canlı lobiyi silmemek için).
execute unless entity @e[type=minecraft:marker,tag=marsana_lobby.center] run return run tellraw @s {"text":"[Marsana] Lobi merkezi bulunamadı.","color":"red"}
execute as @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] at @s unless dimension marsana_lobby:lobi run return run tellraw @s {"text":"[Marsana] Lobi henüz taşınmadı; önce /function marsana_lobby:tasi","color":"red"}
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in minecraft:overworld run forceload add ~-49 ~-49 ~49 ~49
schedule function marsana_lobby:tasi/sil 40t replace
tellraw @s {"text":"[Marsana] Eski lobi kaldırılıyor (2 saniye)...","color":"yellow"}
