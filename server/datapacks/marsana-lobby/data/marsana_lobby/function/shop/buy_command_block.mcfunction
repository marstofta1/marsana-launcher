execute unless score @s marsanaty matches 300.. run return run function marsana_lobby:shop/poor
scoreboard players remove @s marsanaty 300
give @s minecraft:command_block 1
tellraw @s ["",{"text":"[Shop] ","color":"green"},{"text":"Komut bloğu satın alındı. Kalan: ","color":"gray"},{"score":{"name":"@s","objective":"marsanaty"},"color":"gold"},{"text":" Marsanaty","color":"gold"}]
