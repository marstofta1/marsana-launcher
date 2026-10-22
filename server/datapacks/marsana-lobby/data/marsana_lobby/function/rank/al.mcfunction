# Kullanım (op): /function marsana_lobby:rank/al {oyuncu:"isim"} — Moderatör rankını geri alır (para iade edilmez). Oyuncu çevrimiçi olmalı.
$tag $(oyuncu) remove marsana.rank.mod
$team join marsana.oyuncu $(oyuncu)
$tellraw @s {"text":"[Klima] $(oyuncu) artık Oyuncu.","color":"gold"}
