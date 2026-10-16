# /trigger warp set <id> — Warps köylüsünün menüsünden tıklanır.
execute store result storage marsana_lobby:warps want.id int 1 run scoreboard players get @s warp
scoreboard players reset @s warp
function marsana_lobby:warp/go with storage marsana_lobby:warps want
