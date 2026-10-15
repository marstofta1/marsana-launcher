execute unless score @s marsanaty matches 1000.. run return run function marsana_lobby:shop/poor
scoreboard players remove @s marsanaty 1000
give @s minecraft:barrier 1
tellraw @s ["",{"text":"[Shop] ","color":"green"},{"text":"Bariyer satın alındı. Kalan: ","color":"gray"},{"score":{"name":"@s","objective":"marsanaty"},"color":"gold"},{"text":" Marsanaty","color":"gold"}]
