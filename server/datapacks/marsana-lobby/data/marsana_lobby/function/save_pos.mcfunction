# Lobiye ışınlanmadan önceki konum; Create Dünyası NPC'si oyuncuyu buraya geri gönderir.
# Lobinin içindeyse (ör. yeni oyuncu) kaydedilmez.
execute at @s if dimension marsana_lobby:lobi run return 0
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-20 ~-10 ~-20 if entity @s[dx=40,dy=40,dz=40] run return 0
function marsana_lobby:save_pos_force
