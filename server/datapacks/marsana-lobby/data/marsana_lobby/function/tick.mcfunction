# Girişte lobiye ışınlama: ilk kez görülen ya da oyundan çıkıp geri gelen oyuncu "bekliyor" olur.
tag @a[tag=!marsana_lobby.seen] add marsana_lobby.pending
tag @a[tag=!marsana_lobby.seen] add marsana_lobby.seen
tag @a[scores={marsana_lobby.left=1..}] add marsana_lobby.pending
scoreboard players reset @a[scores={marsana_lobby.left=1..}] marsana_lobby.left
execute as @a[tag=marsana_lobby.pending] run function marsana_lobby:join_wait

# /trigger lobi — herkes lobiye dönebilir.
scoreboard players enable @a lobi
execute as @a[scores={lobi=1..}] run function marsana_lobby:lobi

# Lobi kutusu: merkezden yatayda ±20, dikeyde -10..+30 blok.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-20 ~-10 ~-20 run tag @a[dx=40,dy=40,dz=40] add marsana_lobby.in
execute as @a[tag=marsana_lobby.in] run function marsana_lobby:inside
execute as @a[tag=!marsana_lobby.in,tag=marsana_lobby.adv] run function marsana_lobby:outside
tag @a remove marsana_lobby.in
