# Kullanım (op): warp olacak yerde, bakılacak yöne dönerek
#   /function marsana_lobby:warp/ayarla {ad:"Parkur"}
# Aynı isimde warp varsa yerini günceller. Sonra Warps köylüsünde listelenir.
$data remove storage marsana_lobby:warps list[{ad:"$(ad)"}]
execute store result score #id marsana_lobby.calc run data get storage marsana_lobby:warps next
scoreboard players add #id marsana_lobby.calc 1
execute store result storage marsana_lobby:warps next int 1 run scoreboard players get #id marsana_lobby.calc
$data modify storage marsana_lobby:warps new set value {ad:"$(ad)"}
execute store result storage marsana_lobby:warps new.id int 1 run scoreboard players get #id marsana_lobby.calc
execute store result storage marsana_lobby:warps new.x int 1 run data get entity @s Pos[0]
execute store result storage marsana_lobby:warps new.y int 1 run data get entity @s Pos[1]
execute store result storage marsana_lobby:warps new.z int 1 run data get entity @s Pos[2]
execute store result storage marsana_lobby:warps new.yaw int 1 run data get entity @s Rotation[0]
data modify storage marsana_lobby:warps new.dim set from entity @s Dimension
data modify storage marsana_lobby:warps list append from storage marsana_lobby:warps new
$tellraw @s {"text":"[Marsana] \"$(ad)\" warpı buraya ayarlandı.","color":"green"}
