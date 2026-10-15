advancement revoke @s only marsana_lobby:npc/afk
execute if entity @s[tag=marsana_lobby.afk] run return run tellraw @s {"text":"Zaten AFK modundasın. Çıkmak için hareket et.","color":"gray"}
function marsana_lobby:afk/enter
