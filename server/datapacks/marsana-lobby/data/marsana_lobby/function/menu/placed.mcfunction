scoreboard players reset @s marsana_lobby.plan
# Yalnızca menü eşyasıyla asılan üretim planı silinir; normal planlara dokunulmaz.
execute unless predicate marsana_lobby:menu_el run return 0
kill @e[type=create:crafting_blueprint,tag=!marsana_lobby.plan_eski,distance=..8,sort=nearest,limit=1]
function marsana_lobby:menu/open
