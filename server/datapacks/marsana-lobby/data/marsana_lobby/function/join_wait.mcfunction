# Login System oyuncuyu girişte bekleme alanında tutar (loginsystem.properties: waitingAreaX/Y/Z,
# varsayılan 0 100 0), /login sonrası son konumuna ışınlar. Lobiye ışınlama bu ışınlamadan sonra,
# oyuncu bekleme alanından ayrıldığında yapılır. Bekleme alanı değişirse buradaki konumu da güncelle.
scoreboard players add @s marsana_lobby 1
execute in minecraft:overworld positioned 0 100 0 if entity @s[distance=..5] run tag @s add marsana_lobby.waiting
execute if entity @s[tag=marsana_lobby.waiting] in minecraft:overworld positioned 0 100 0 unless entity @s[distance=..5] run return run function marsana_lobby:join_done
# 5 saniyede bekleme alanına alınmadıysa giriş modu yoktur: doğrudan lobiye.
execute if entity @s[tag=!marsana_lobby.waiting] if score @s marsana_lobby matches 100.. run return run function marsana_lobby:join_done
# Giriş yapılmadan 2 dakika geçerse (Login System zaten atar) bekleme bırakılır.
execute if score @s marsana_lobby matches 2400.. run function marsana_lobby:join_clear
