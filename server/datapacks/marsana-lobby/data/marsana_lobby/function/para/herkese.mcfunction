# Kullanım (op): /function marsana_lobby:para/herkese {miktar:50}
# Etkinliğe katılan, o an çevrimiçi olan herkese Marsanaty verir.
$scoreboard players add @a marsanaty $(miktar)
$tellraw @a ["",{"text":"[Marsana] ","color":"gold"},{"text":"Etkinliğe katılan herkes $(miktar) Marsanaty kazandı!","color":"gold"}]
