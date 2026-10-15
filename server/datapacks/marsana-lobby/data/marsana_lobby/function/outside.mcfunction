# Lobiden çıkan oyuncu: lobinin verdiği macera modu geri alınır.
execute if entity @s[gamemode=adventure] run gamemode survival @s
tag @s remove marsana_lobby.adv
title @s actionbar {"text":"Survival dünyasına geçtin","color":"green"}
