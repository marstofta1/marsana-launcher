# Kayıtlı konumu olmayan (yeni) oyuncu: lobinin çevresinde 300 blok içinde rastgele güvenli bir nokta.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run spreadplayers ~ ~ 0 300 false @s
tellraw @s {"text":"[Marsana] Create dünyasına hoş geldin! Lobiye dönmek için: /trigger lobi","color":"gold"}
