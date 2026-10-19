scoreboard players add #try marsana_lobby.calc 1
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in minecraft:overworld run spreadplayers ~ ~ 0 300 false @s
execute if score #try marsana_lobby.calc matches ..10 at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in minecraft:overworld positioned ~-55 ~-64 ~-55 if entity @s[dx=110,dy=400,dz=110] run function marsana_lobby:npc/create_random_try
