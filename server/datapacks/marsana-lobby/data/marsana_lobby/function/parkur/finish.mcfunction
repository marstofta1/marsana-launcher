# Parkur bitiş platformuna ulaşan oyuncu: kutlama, herkese duyuru, başlangıca ışınlama.
tag @s add marsana_lobby.parkur_cd
title @s title {"text":"Parkur tamamlandı!","color":"gold","bold":true}
tellraw @a ["",{"text":"[Parkur] ","color":"aqua"},{"selector":"@s","color":"yellow"},{"text":" parkuru tamamladı!","color":"gray"}]
playsound minecraft:ui.toast.challenge_complete master @s
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run tp @s ~-20 ~1 ~-22
