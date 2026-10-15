gamemode adventure @s
tag @s add marsana_lobby.adv
# Lobiye yürüyerek girenin (kenardan) giriş noktası kaydedilir; ışınlananın merkezdeki konumu kaydedilmez.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] unless entity @s[distance=..14] run function marsana_lobby:save_pos_force
execute unless entity @s[tag=marsana_lobby.no_notify] run title @s actionbar {"text":"Marsana Lobi — korumalı alan","color":"gold"}
