# #sn'den SS:DD hanelerini çıkarır, menüdeki saat satırını makroyla yazar.
scoreboard players operation #h marsana_lobby.saat = #sn marsana_lobby.saat
scoreboard players operation #h marsana_lobby.saat /= #3600 marsana_lobby.saat
scoreboard players operation #m marsana_lobby.saat = #sn marsana_lobby.saat
scoreboard players operation #m marsana_lobby.saat %= #3600 marsana_lobby.saat
scoreboard players operation #m marsana_lobby.saat /= #60 marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat = #h marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat /= #10 marsana_lobby.saat
execute store result storage marsana_lobby:saat h1 int 1 run scoreboard players get #d marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat = #h marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat %= #10 marsana_lobby.saat
execute store result storage marsana_lobby:saat h2 int 1 run scoreboard players get #d marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat = #m marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat /= #10 marsana_lobby.saat
execute store result storage marsana_lobby:saat m1 int 1 run scoreboard players get #d marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat = #m marsana_lobby.saat
scoreboard players operation #d marsana_lobby.saat %= #10 marsana_lobby.saat
execute store result storage marsana_lobby:saat m2 int 1 run scoreboard players get #d marsana_lobby.saat
function marsana_lobby:saat/line with storage marsana_lobby:saat
