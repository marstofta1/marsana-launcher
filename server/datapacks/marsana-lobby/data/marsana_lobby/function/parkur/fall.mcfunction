# Parkurdayken zemine düşen oyuncu: başlangıç platformuna (yeşil), ilk atlamaya (batıya) bakarak.
tag @s remove marsana_lobby.parkur
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run tp @s ~-20 ~1 ~-22 90 0
title @s actionbar {"text":"Düştün! Parkurun başına döndün.","color":"red"}
playsound minecraft:entity.enderman.teleport master @s
