# AFK'ya girerken konumu kaydet (x10). Bu konumdan yarım bloktan fazla uzaklaşınca AFK biter.
execute store result score @s marsana_lobby.ax run data get entity @s Pos[0] 10
execute store result score @s marsana_lobby.ay run data get entity @s Pos[1] 10
execute store result score @s marsana_lobby.az run data get entity @s Pos[2] 10
tag @s add marsana_lobby.afk
tellraw @a ["",{"text":"[AFK] ","color":"aqua","bold":true},{"selector":"@s","color":"yellow"},{"text":" AFK oldu.","color":"gray"}]
tellraw @s {"text":"AFK modundasın. Hareket edince otomatik çıkarsın.","color":"aqua"}
