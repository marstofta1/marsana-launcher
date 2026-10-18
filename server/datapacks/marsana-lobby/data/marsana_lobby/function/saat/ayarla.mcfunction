# Kullanım (op): /function marsana_lobby:saat/ayarla {saat:14,dakika:30}
# Türkiye saatini (UTC+3) ayarlar. Datapack gerçek saati okuyamaz; saat oyun tick'leriyle ilerler.
# Sunucu her açıldığında (ve /reload sonrası) saat "--:--" olur, yeniden ayarlanmalı.
$scoreboard players set #h marsana_lobby.saat $(saat)
$scoreboard players set #m marsana_lobby.saat $(dakika)
execute unless score #h marsana_lobby.saat matches 0..23 run return run tellraw @s {"text":"[Marsana] Saat 0-23 arasında olmalı.","color":"red"}
execute unless score #m marsana_lobby.saat matches 0..59 run return run tellraw @s {"text":"[Marsana] Dakika 0-59 arasında olmalı.","color":"red"}
scoreboard players operation #sn marsana_lobby.saat = #h marsana_lobby.saat
scoreboard players operation #sn marsana_lobby.saat *= #3600 marsana_lobby.saat
scoreboard players operation #m marsana_lobby.saat *= #60 marsana_lobby.saat
scoreboard players operation #sn marsana_lobby.saat += #m marsana_lobby.saat
scoreboard players set #tick marsana_lobby.saat 0
scoreboard players set #sync marsana_lobby.saat 1
function marsana_lobby:sidebar/refresh
tellraw @s {"text":"[Marsana] Türkiye saati ayarlandı.","color":"green"}
