execute store result storage marsana_lobby:tmp p.x double 0.1 run scoreboard players get @s marsana_lobby.d2x
execute store result storage marsana_lobby:tmp p.y double 0.01 run scoreboard players get @s marsana_lobby.d2y
execute store result storage marsana_lobby:tmp p.z double 0.1 run scoreboard players get @s marsana_lobby.d2z
data modify storage marsana_lobby:tmp p.dim set value "marsana_lobby:duz2"
function marsana_lobby:npc/tp_saved with storage marsana_lobby:tmp p
