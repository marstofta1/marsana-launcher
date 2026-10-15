# Kutu bloğu bir tık aşar; böylece bloğa yapılan sol tık kutuya gider.
scoreboard players set #hit marsana_lobby.calc 1
execute align xyz positioned ~0.5 ~-0.001 ~0.5 as @e[type=minecraft:interaction,tag=marsana_lobby.mine] run tp @s ~ ~ ~
execute as @e[type=minecraft:interaction,tag=marsana_lobby.mine] run data merge entity @s {width:1.002f,height:1.002f}
