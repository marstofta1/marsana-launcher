# Kullanım (op): /function marsana_lobby:rank/ver {oyuncu:"isim"} — Moderatör rankını parasız verir. Oyuncu çevrimiçi olmalı.
$tag $(oyuncu) add marsana.rank.mod
$team join marsana.mod $(oyuncu)
$tellraw @s {"text":"[Marsana] $(oyuncu) artık Moderatör.","color":"gold"}
