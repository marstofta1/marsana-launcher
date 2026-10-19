execute unless data storage marsana_lobby:tmp w[0] run return 0
data modify storage marsana_lobby:tmp cur set from storage marsana_lobby:tmp w[0]
data remove storage marsana_lobby:tmp w[0]
execute store result score #wx marsana_lobby.calc run data get storage marsana_lobby:tmp cur.x
execute store result score #wz marsana_lobby.calc run data get storage marsana_lobby:tmp cur.z
scoreboard players operation #wx marsana_lobby.calc -= #cx marsana_lobby.calc
scoreboard players operation #wz marsana_lobby.calc -= #cz marsana_lobby.calc
execute if data storage marsana_lobby:tmp cur{dim:"minecraft:overworld"} if score #wx marsana_lobby.calc matches -49..49 if score #wz marsana_lobby.calc matches -49..49 run data modify storage marsana_lobby:tmp cur.dim set value "marsana_lobby:lobi"
data modify storage marsana_lobby:warps list append from storage marsana_lobby:tmp cur
function marsana_lobby:tasi/warp_next
