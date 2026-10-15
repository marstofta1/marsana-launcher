# Saniyede bir: eski lobi marker'larını sil, lobideki düşman yaratıkları boşluğa gönder (eşya düşürmezler).
execute as @e[type=minecraft:marker,tag=marsana_lobby.center] unless score @s marsana_lobby = #gen marsana_lobby run kill @s
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-20 ~-10 ~-20 as @e[type=#marsana_lobby:hostile,dx=40,dy=40,dz=40] at @s run tp @s ~ -400 ~
# Çöp NPC'sinin yanına atılan eşyalar silinir.
execute as @e[type=minecraft:interaction,tag=marsana_lobby.npc_trash] at @s run kill @e[type=minecraft:item,distance=..1.5]
schedule function marsana_lobby:mobs 20t replace
