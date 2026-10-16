# Kullanım (op): lobinin merkezi olacak yerde, zeminde durup "/function marsana_lobby:build".
# 97x97 alanı temizleyip lobiyi kurar (iç lobi + genişleme), dünya doğuş noktasını lobinin ortasına taşır.
# Tekrar çalıştırılırsa yeni konum geçerli olur; eski bina yerinde kalır.
scoreboard players add #gen marsana_lobby 1
kill @e[type=minecraft:marker,tag=marsana_lobby.center]
execute align xyz positioned ~0.5 ~ ~0.5 run summon minecraft:marker ~ ~ ~ {Tags:["marsana_lobby.center","marsana_lobby.new"]}
execute as @e[type=minecraft:marker,tag=marsana_lobby.new] run scoreboard players operation @s marsana_lobby = #gen marsana_lobby
execute at @e[type=minecraft:marker,tag=marsana_lobby.new,limit=1] run function marsana_lobby:structure
execute at @e[type=minecraft:marker,tag=marsana_lobby.new,limit=1] run function marsana_lobby:expansion
execute at @e[type=minecraft:marker,tag=marsana_lobby.new,limit=1] run function marsana_lobby:roof
execute at @e[type=minecraft:marker,tag=marsana_lobby.new,limit=1] run setworldspawn ~ ~ ~ 180
tag @e[type=minecraft:marker,tag=marsana_lobby.new] remove marsana_lobby.new
gamerule spawnRadius 0
tellraw @s {"text":"[Marsana] Lobi kuruldu, doğuş noktası lobinin ortasına alındı.","color":"green"}
