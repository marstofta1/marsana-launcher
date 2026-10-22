# Temel katmanının (merkezin 6 altı) iki köşesi de havaysa chunk kaybolmuştur: geçici kopyadan geri al.
$execute in marsana_lobby:lobi unless block $(xa) $(y0) $(za) minecraft:air run return 0
$execute in marsana_lobby:lobi unless block $(xb) $(y0) $(zb) minecraft:air run return 0
$execute in marsana_lobby:lobi run clone from marsana_lobby:lobi $(sxa) $(y0) $(za) $(sxb) $(y1) $(zb) to marsana_lobby:lobi $(xa) $(y0) $(za)
scoreboard players add #onarilan marsana_lobby.calc 1
