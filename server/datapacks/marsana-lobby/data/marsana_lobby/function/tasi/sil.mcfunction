execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in minecraft:overworld run function marsana_lobby:tasi/sil_blok
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in minecraft:overworld run forceload remove ~-49 ~-49 ~49 ~49
tellraw @a[tag=marsana.admin] {"text":"[Klima] Spawn'daki eski lobi kaldırıldı.","color":"green"}
