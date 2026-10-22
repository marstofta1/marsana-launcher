advancement revoke @s only marsana_lobby:npc/create
execute unless score @s marsana_lobby.ph matches 1 run return run function marsana_lobby:npc/create_random
execute store result storage marsana_lobby:tmp p.x double 0.1 run scoreboard players get @s marsana_lobby.px
execute store result storage marsana_lobby:tmp p.y double 0.01 run scoreboard players get @s marsana_lobby.py
execute store result storage marsana_lobby:tmp p.z double 0.1 run scoreboard players get @s marsana_lobby.pz
data modify storage marsana_lobby:tmp p.dim set value "minecraft:overworld"
execute if score @s marsana_lobby.pd matches -1 run data modify storage marsana_lobby:tmp p.dim set value "minecraft:the_nether"
execute if score @s marsana_lobby.pd matches 1 run data modify storage marsana_lobby:tmp p.dim set value "minecraft:the_end"
function marsana_lobby:npc/tp_saved with storage marsana_lobby:tmp p
tellraw @s {"text":"[Klima] Create dünyasına, kaldığın yere ışınlandın.","color":"gold"}
