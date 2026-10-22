# onar'dan 2 saniye sonra (chunk'lar yüklenince): geçici kopyayı kur, boş chunk'ları ondan geri al, kopyayı sil.
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run function marsana_lobby:structure
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run function marsana_lobby:expansion
execute at @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] positioned ~1024 ~ ~ run function marsana_lobby:roof
# Merkez ve sınırlar (blok koordinatı). Yapı merkezden ±48, -6..+30 içinde.
execute store result score #cx marsana_lobby.calc run data get entity @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] Pos[0]
execute store result score #cy marsana_lobby.calc run data get entity @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] Pos[1]
execute store result score #cz marsana_lobby.calc run data get entity @e[type=minecraft:marker,tag=marsana_lobby.center,limit=1] Pos[2]
scoreboard players set #16 marsana_lobby.calc 16
scoreboard players set #48 marsana_lobby.calc 48
scoreboard players operation #xlo marsana_lobby.calc = #cx marsana_lobby.calc
scoreboard players operation #xlo marsana_lobby.calc -= #48 marsana_lobby.calc
scoreboard players operation #xhi marsana_lobby.calc = #cx marsana_lobby.calc
scoreboard players operation #xhi marsana_lobby.calc += #48 marsana_lobby.calc
scoreboard players operation #zlo marsana_lobby.calc = #cz marsana_lobby.calc
scoreboard players operation #zlo marsana_lobby.calc -= #48 marsana_lobby.calc
scoreboard players operation #zhi marsana_lobby.calc = #cz marsana_lobby.calc
scoreboard players operation #zhi marsana_lobby.calc += #48 marsana_lobby.calc
scoreboard players operation #y0 marsana_lobby.calc = #cy marsana_lobby.calc
scoreboard players remove #y0 marsana_lobby.calc 6
scoreboard players operation #y1 marsana_lobby.calc = #cy marsana_lobby.calc
scoreboard players add #y1 marsana_lobby.calc 30
# İlk chunk'ların başı (16'nın katı; scoreboard bölmesi aşağı yuvarlar).
scoreboard players operation #chx marsana_lobby.calc = #xlo marsana_lobby.calc
scoreboard players operation #chx marsana_lobby.calc /= #16 marsana_lobby.calc
scoreboard players operation #chx marsana_lobby.calc *= #16 marsana_lobby.calc
scoreboard players operation #z0 marsana_lobby.calc = #zlo marsana_lobby.calc
scoreboard players operation #z0 marsana_lobby.calc /= #16 marsana_lobby.calc
scoreboard players operation #z0 marsana_lobby.calc *= #16 marsana_lobby.calc
scoreboard players set #onarilan marsana_lobby.calc 0
function marsana_lobby:onar/x
function marsana_lobby:onar/temizle
tellraw @a[tag=marsana.admin] ["",{"text":"[Marsana] Lobi onarıldı, geri alınan chunk: ","color":"green"},{"score":{"name":"#onarilan","objective":"marsana_lobby.calc"},"color":"green"}]
