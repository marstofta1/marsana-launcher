# Lobideki korumalı oyuncu için (göz hizasında, oyuncunun bakış yönüyle çalışır): oyuncunun kendi
# tıklama kutusunu bul ya da oluştur, baktığı bloğa taşı. Bakılan blok yoksa kutu sıfır boyuta iner.
execute unless score @s marsana_lobby.pid matches 1.. run function marsana_lobby:claim/new_id
scoreboard players operation #pid marsana_lobby.calc = @s marsana_lobby.pid
execute as @e[type=minecraft:interaction,tag=marsana_lobby.claimbox] if score @s marsana_lobby.pid = #pid marsana_lobby.calc run tag @s add marsana_lobby.mine
execute unless entity @e[type=minecraft:interaction,tag=marsana_lobby.mine] run summon minecraft:interaction ~ ~-3 ~ {Tags:["marsana_lobby.claimbox","marsana_lobby.mine","marsana_lobby.new"],width:0f,height:0f}
scoreboard players operation @e[type=minecraft:interaction,tag=marsana_lobby.new] marsana_lobby.pid = #pid marsana_lobby.calc
tag @e[type=minecraft:interaction,tag=marsana_lobby.new] remove marsana_lobby.new
tag @e[type=minecraft:interaction,tag=marsana_lobby.mine] remove marsana_lobby.stale
scoreboard players set #hit marsana_lobby.calc 0
scoreboard players set #steps marsana_lobby.calc 0
function marsana_lobby:claim/ray
execute if score #hit marsana_lobby.calc matches 0 as @e[type=minecraft:interaction,tag=marsana_lobby.mine] run data merge entity @s {width:0f,height:0f}
tag @e[type=minecraft:interaction,tag=marsana_lobby.mine] remove marsana_lobby.mine
