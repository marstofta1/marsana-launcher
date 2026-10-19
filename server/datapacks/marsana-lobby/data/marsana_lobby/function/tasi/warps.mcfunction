# Eski lobinin içindeki warplar lobi boyutuna çevrilir (koordinatlar aynı kalır).
execute store result score #cx marsana_lobby.calc run data get entity @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] Pos[0]
execute store result score #cz marsana_lobby.calc run data get entity @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] Pos[2]
data remove storage marsana_lobby:tmp w
data modify storage marsana_lobby:tmp w set from storage marsana_lobby:warps list
execute unless data storage marsana_lobby:tmp w[0] run return 0
data modify storage marsana_lobby:warps list set value []
function marsana_lobby:tasi/warp_next
