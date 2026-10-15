# Kullanım (op): /function marsana_lobby:para/ver {oyuncu:"isim",miktar:100}
# Etkinlik kazananına Marsanaty verir. Oyuncu çevrimdışıysa da hesabına eklenir.
$scoreboard players add $(oyuncu) marsanaty $(miktar)
$tellraw @a ["",{"text":"[Marsana] ","color":"gold"},{"text":"$(oyuncu)","color":"yellow"},{"text":" etkinlikten $(miktar) Marsanaty kazandı!","color":"gold"}]
