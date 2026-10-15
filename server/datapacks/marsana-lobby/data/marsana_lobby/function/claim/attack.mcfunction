# Bir tıklama kutusuna sol tık (lobide blok kırma denemesi). Mesaj en fazla 2 saniyede bir.
advancement revoke @s only marsana_lobby:claim
execute if entity @s[tag=marsana.admin] run return 0
execute if score @s marsana_lobby.claimcd matches 1.. run return 0
scoreboard players set @s marsana_lobby.claimcd 40
tellraw @s {"text":"Burası claim'li, kıramazsın!","color":"red"}
