advancement revoke @s only marsana_lobby:npc/duz
# Create Dünyası 2: Create dünyasından (overworld) ayrı düz dünya boyutu (marsana_lobby:duz2).
# Orada kaldığı yer varsa oraya, yoksa boyutun ortasına (çimen y 63, üstü 64) ışınlar.
# Zemin y 63 üstünde olmalı: sunucu dünyası düz olmadığından istemci bu boyutta ufku 63 sayar,
# altında duran oyuncunun gökyüzü gündüz de kararır.
function marsana_lobby:save_pos
execute unless score @s marsana_lobby.d2h matches 1 in marsana_lobby:duz2 run tp @s 0.5 64 0.5 0 0
execute if score @s marsana_lobby.d2h matches 1 run function marsana_lobby:npc/tp_duz
tellraw @s {"text":"[Klima] Create Dünyası 2'ye (düz dünya) ışınlandın. Lobiye dönmek için: /trigger lobi","color":"yellow"}
