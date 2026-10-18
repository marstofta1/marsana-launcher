# Menü her saniye sıfırdan kurulur; böylece çıkan oyuncular listeden düşer.
# Üstteki üç satır sahte oyuncudur (çok yüksek puanla en üstte durur, puanları gizlidir).
scoreboard players reset * marsana_lobby.sb
scoreboard players set klima.saat marsana_lobby.sb 2147483647
scoreboard players set klima.bos marsana_lobby.sb 2147483646
scoreboard players set klima.baslik marsana_lobby.sb 2147483645
scoreboard players display numberformat klima.saat marsana_lobby.sb blank
scoreboard players display numberformat klima.bos marsana_lobby.sb blank
scoreboard players display numberformat klima.baslik marsana_lobby.sb blank
execute if score #sync marsana_lobby.saat matches 1 run function marsana_lobby:saat/text
execute unless score #sync marsana_lobby.saat matches 1 run scoreboard players display name klima.saat marsana_lobby.sb {"text":"Saat (TR): --:--","color":"gray"}
scoreboard players display name klima.bos marsana_lobby.sb {"text":" "}
scoreboard players display name klima.baslik marsana_lobby.sb ["",{"text":"Oyuncu","color":"yellow"},{"text":" · ","color":"dark_gray"},{"text":"Marsanaty","color":"gold"}]
# Çevrimiçi oyuncular: adı solda, Marsanaty bakiyesi sağda (bakiyesi olmayan 0).
scoreboard players set @a marsana_lobby.sb 0
execute as @a run scoreboard players operation @s marsana_lobby.sb = @s marsanaty
