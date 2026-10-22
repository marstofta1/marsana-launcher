# Gözün 0,6 blok önünde (bu konumda çalışır): oyuncunun kendi kutusunu bul ya da oluştur, buraya taşı.
execute unless score @s marsana_lobby.pid matches 1.. run function marsana_lobby:claim/new_id
scoreboard players operation #pid marsana_lobby.calc = @s marsana_lobby.pid
execute as @e[type=minecraft:interaction,tag=marsana_lobby.menubox] if score @s marsana_lobby.pid = #pid marsana_lobby.calc run tag @s add marsana_lobby.mymenu
execute unless entity @e[type=minecraft:interaction,tag=marsana_lobby.mymenu] run summon minecraft:interaction ~ ~-0.3 ~ {Tags:["marsana_lobby.menubox","marsana_lobby.mymenu","marsana_lobby.new"],width:0.6f,height:0.6f,response:1b}
scoreboard players operation @e[type=minecraft:interaction,tag=marsana_lobby.new] marsana_lobby.pid = #pid marsana_lobby.calc
tag @e[type=minecraft:interaction,tag=marsana_lobby.new] remove marsana_lobby.new
tp @e[type=minecraft:interaction,tag=marsana_lobby.mymenu] ~ ~-0.3 ~
tag @e[type=minecraft:interaction,tag=marsana_lobby.mymenu] remove marsana_lobby.menustale
tag @e[type=minecraft:interaction,tag=marsana_lobby.mymenu] remove marsana_lobby.mymenu
