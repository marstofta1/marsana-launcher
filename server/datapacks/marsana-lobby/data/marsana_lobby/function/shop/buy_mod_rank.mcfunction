execute if entity @s[tag=marsana.rank.mod] run return run tellraw @s ["",{"text":"[Shop] ","color":"green"},{"text":"Zaten Moderatör rankın var.","color":"gray"}]
execute unless score @s marsanaty matches 7000.. run return run function marsana_lobby:shop/poor
scoreboard players remove @s marsanaty 7000
tag @s add marsana.rank.mod
team join marsana.mod @s
tellraw @s ["",{"text":"[Shop] ","color":"green"},{"text":"Moderatör rankı satın alındı. Kalan: ","color":"gray"},{"score":{"name":"@s","objective":"marsanaty"},"color":"gold"},{"text":" Marsanaty","color":"gold"}]
tellraw @a ["",{"text":"[Klima] ","color":"gold"},{"selector":"@s","color":"yellow"},{"text":" artık ","color":"gold"},{"text":"Moderatör","color":"aqua","bold":true},{"text":"!","color":"gold"}]
