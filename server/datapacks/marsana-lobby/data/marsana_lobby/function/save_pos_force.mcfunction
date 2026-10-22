# Lobi boyutundaki konum kaydedilmez (Create Dünyası NPC'si oyuncuyu oraya göndermesin).
execute at @s if dimension marsana_lobby:lobi run return 0
# End lobisindeki konum da kaydedilmez.
execute in minecraft:the_end positioned -10 52 -10 if entity @s[dx=20,dy=30,dz=20] run return 0
execute store result score @s marsana_lobby.px run data get entity @s Pos[0] 10
execute store result score @s marsana_lobby.py run data get entity @s Pos[1] 100
execute store result score @s marsana_lobby.pz run data get entity @s Pos[2] 10
scoreboard players set @s marsana_lobby.pd 0
execute at @s if dimension minecraft:the_nether run scoreboard players set @s marsana_lobby.pd -1
execute at @s if dimension minecraft:the_end run scoreboard players set @s marsana_lobby.pd 1
scoreboard players set @s marsana_lobby.ph 1
