# Kullanım (op): /function marsana_lobby:para/al {oyuncu:"isim",miktar:100}
# Yanlış verilen Marsanaty'yi geri alır (sessizce).
$scoreboard players remove $(oyuncu) marsanaty $(miktar)
$tellraw @s ["",{"text":"[Klima] $(oyuncu) oyuncusundan $(miktar) Marsanaty alındı. Yeni bakiye: ","color":"yellow"},{"score":{"name":"$(oyuncu)","objective":"marsanaty"},"color":"gold"}]
