gamemode adventure @s
tag @s add marsana_lobby.adv
# Lobiye yürüyerek girenin (kenardan) giriş noktası kaydedilir; ışınlananın merkezdeki konumu kaydedilmez.
# End lobisine girenin konumu kaydedilmez (Create Dünyası NPC'si oyuncuyu End lobisine göndermesin).
execute at @s if dimension minecraft:the_end run return run execute unless entity @s[tag=marsana_lobby.no_notify] run title @s actionbar {"text":"End Lobisi — korumalı alan","color":"dark_purple"}
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] unless entity @s[distance=..14] run function marsana_lobby:save_pos_force
execute unless entity @s[tag=marsana_lobby.no_notify] run title @s actionbar {"text":"Klima Lobi — korumalı alan","color":"gold"}
