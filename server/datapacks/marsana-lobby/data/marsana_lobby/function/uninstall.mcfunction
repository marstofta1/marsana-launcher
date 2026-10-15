# Datapack'i kaldırmadan önce çalıştır: çevrimiçi oyuncuların macera modunu geri alır, korumayı kapatır.
# Bina yerinde kalır.
execute as @a[tag=marsana_lobby.adv,gamemode=adventure] run gamemode survival @s
tag @a remove marsana_lobby.adv
kill @e[type=minecraft:marker,tag=marsana_lobby.center]
schedule clear marsana_lobby:mobs
scoreboard objectives remove marsana_lobby
tellraw @s {"text":"[Marsana] Lobi koruması kapatıldı. Şimdi datapack'i silebilirsin.","color":"yellow"}
