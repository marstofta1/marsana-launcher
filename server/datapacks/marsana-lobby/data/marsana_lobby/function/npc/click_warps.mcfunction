advancement revoke @s only marsana_lobby:npc/warps
tellraw @s ["",{"text":"━━━━━ ","color":"dark_gray"},{"text":"Warps","color":"light_purple","bold":true},{"text":" ━━━━━ ","color":"dark_gray"},{"text":"(gitmek için tıkla)","color":"dark_gray","italic":true}]
execute unless data storage marsana_lobby:warps list[0] run return run tellraw @s {"text":" Henüz warp yok. Admin: /function marsana_lobby:warp/ayarla {ad:\"isim\"}","color":"gray"}
tag @s add marsana_lobby.warp_viewer
data modify storage marsana_lobby:warps iter set from storage marsana_lobby:warps list
function marsana_lobby:warp/list_next
tag @s remove marsana_lobby.warp_viewer
