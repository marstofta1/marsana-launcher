# Günün saniyesi (#sn, 0..86399) bir artar, gece yarısında başa döner.
scoreboard players add #sn marsana_lobby.saat 1
execute if score #sn marsana_lobby.saat matches 86400.. run scoreboard players remove #sn marsana_lobby.saat 86400
