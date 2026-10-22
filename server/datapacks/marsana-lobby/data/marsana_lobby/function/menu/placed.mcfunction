scoreboard players reset @s marsana_lobby.tablo
# Yalnızca menü eşyasıyla asılan tablo silinir; normal tablolara dokunulmaz.
execute unless predicate marsana_lobby:menu_el run return 0
kill @e[type=minecraft:painting,tag=!marsana_lobby.tablo_eski,distance=..8,sort=nearest,limit=1]
function marsana_lobby:menu/open
