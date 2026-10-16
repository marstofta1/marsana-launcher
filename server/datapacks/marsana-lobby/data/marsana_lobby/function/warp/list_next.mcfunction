# Warp listesini sırayla gezip her biri için tıklanabilir bir satır yazar.
execute unless data storage marsana_lobby:warps iter[0] run return 0
function marsana_lobby:warp/line with storage marsana_lobby:warps iter[0]
data remove storage marsana_lobby:warps iter[0]
function marsana_lobby:warp/list_next
