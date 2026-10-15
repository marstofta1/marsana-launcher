# Lobi kutusu: merkezden yatayda ±20, dikeyde -10..+30 blok.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-20 ~-10 ~-20 run tag @a[dx=40,dy=40,dz=40] add marsana_lobby.in
execute as @a[tag=marsana_lobby.in] run function marsana_lobby:inside
execute as @a[tag=!marsana_lobby.in,tag=marsana_lobby.adv] run function marsana_lobby:outside
tag @a remove marsana_lobby.in
