# Lobiden çıkan oyuncu: lobinin verdiği macera modu geri alınır.
execute if entity @s[gamemode=adventure] run gamemode survival @s
tag @s remove marsana_lobby.adv
execute unless entity @s[tag=marsana_lobby.no_notify] run title @s actionbar {"text":"Survival dünyasına geçtin","color":"green"}
