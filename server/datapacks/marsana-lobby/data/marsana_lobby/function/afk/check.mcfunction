# Her tick AFK oyuncular için: kayıtlı konumdan farkı hesapla, ±5 (yarım blok) dışındaysa AFK'dan çıkar.
execute store result score #dx marsana_lobby.calc run data get entity @s Pos[0] 10
execute store result score #dy marsana_lobby.calc run data get entity @s Pos[1] 10
execute store result score #dz marsana_lobby.calc run data get entity @s Pos[2] 10
scoreboard players operation #dx marsana_lobby.calc -= @s marsana_lobby.ax
scoreboard players operation #dy marsana_lobby.calc -= @s marsana_lobby.ay
scoreboard players operation #dz marsana_lobby.calc -= @s marsana_lobby.az
execute unless score #dx marsana_lobby.calc matches -5..5 run return run function marsana_lobby:afk/exit
execute unless score #dy marsana_lobby.calc matches -5..5 run return run function marsana_lobby:afk/exit
execute unless score #dz marsana_lobby.calc matches -5..5 run return run function marsana_lobby:afk/exit
title @s actionbar {"text":"AFK — çıkmak için hareket et","color":"aqua"}
