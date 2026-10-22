# tasi'dan 2 saniye sonra (chunk'lar yüklenince) çalışır.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run function marsana_lobby:tasi/clone
# NPC'ler ve süs varlıkları (oyuncu, düşman, yerdeki eşya, geçici tıklama kutuları hariç) aynı konuma.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-49 ~-10 ~-49 as @e[dx=98,dy=40,dz=98,type=!minecraft:player,type=!minecraft:marker,type=!minecraft:item,type=!minecraft:experience_orb,type=!#marsana_lobby:hostile,tag=!marsana_lobby.claimbox] at @s in marsana_lobby:lobi run tp @s ~ ~ ~
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~-49 ~-10 ~-49 run tag @a[dx=98,dy=40,dz=98] add marsana_lobby.tasi_tp
execute as @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] at @s in marsana_lobby:lobi run tp @s ~ ~ ~
# O an eski lobide olan oyuncular yeni lobiye.
execute as @a[tag=marsana_lobby.tasi_tp] run function marsana_lobby:teleport
tag @a remove marsana_lobby.tasi_tp
function marsana_lobby:tasi/warps
# Kaynak chunk'lar bırakılır; lobi boyutunda merkez chunk'ı hep yüklü kalır (ışınlama merkez işaretçisini bulmalı).
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] in minecraft:overworld run forceload remove ~-49 ~-49 ~49 ~49
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload remove ~-49 ~-49 ~49 ~49
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] run forceload add ~ ~
tellraw @a[tag=marsana.admin] {"text":"[Klima] Lobi, lobi boyutuna taşındı. Kontrol ettikten sonra spawn'daki eski binayı /function marsana_lobby:eski_sil ile kaldır.","color":"green"}
