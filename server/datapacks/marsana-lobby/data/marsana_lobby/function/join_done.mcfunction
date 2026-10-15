function marsana_lobby:join_clear
# Ayarlar: "girişte lobiye ışınlan" kapalıysa oyuncu kaldığı yerde kalır.
execute if entity @s[tag=marsana_lobby.no_autolobby] run return 0
function marsana_lobby:save_pos
function marsana_lobby:teleport
