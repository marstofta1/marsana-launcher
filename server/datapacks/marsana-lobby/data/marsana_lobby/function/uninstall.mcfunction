# Datapack'i kaldırmadan önce çalıştır: çevrimiçi oyuncuların macera modunu geri alır, korumayı kapatır,
# yüklü alandaki NPC'leri siler. Bina yerinde kalır. Marsanaty bakiyeleri silinmez.
execute as @a[tag=marsana_lobby.adv,gamemode=adventure] run gamemode survival @s
tag @a remove marsana_lobby.adv
tag @a remove marsana_lobby.pending
tag @a remove marsana_lobby.waiting
tag @a remove marsana_lobby.seen
tag @a remove marsana_lobby.no_autolobby
tag @a remove marsana_lobby.no_notify
tag @a remove marsana_lobby.afk
tag @a remove marsana_lobby.parkur_cd
tag @a remove marsana_lobby.parkur
tag @a remove marsana_lobby.endlobi
kill @e[tag=marsana_lobby.npc]
kill @e[type=minecraft:interaction,tag=marsana_lobby.claimbox]
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload remove ~ ~
kill @e[type=minecraft:marker,tag=marsana_lobby.center]
team remove marsana.oyuncu
team remove marsana.mod
schedule clear marsana_lobby:mobs
scoreboard objectives remove marsana_lobby.sb
scoreboard objectives remove marsana_lobby.respawn
scoreboard objectives remove marsana_lobby.saat
scoreboard objectives remove marsana_lobby
scoreboard objectives remove marsana_lobby.left
scoreboard objectives remove lobi
scoreboard objectives remove ayarlar
scoreboard objectives remove magaza
scoreboard objectives remove warp
scoreboard objectives remove marsana_lobby.px
scoreboard objectives remove marsana_lobby.py
scoreboard objectives remove marsana_lobby.pz
scoreboard objectives remove marsana_lobby.pd
scoreboard objectives remove marsana_lobby.ph
scoreboard objectives remove marsana_lobby.play
scoreboard objectives remove marsana_lobby.deaths
scoreboard objectives remove marsana_lobby.kills
scoreboard objectives remove marsana_lobby.walk
scoreboard objectives remove marsana_lobby.sprint
scoreboard objectives remove marsana_lobby.calc
scoreboard objectives remove marsana_lobby.ax
scoreboard objectives remove marsana_lobby.ay
scoreboard objectives remove marsana_lobby.az
scoreboard objectives remove marsana_lobby.pid
scoreboard objectives remove marsana_lobby.claimcd
tellraw @s {"text":"[Marsana] Lobi koruması kapatıldı. Şimdi datapack'i silebilirsin.","color":"yellow"}
