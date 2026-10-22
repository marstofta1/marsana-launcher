# /trigger isinlan set 1 Create, 2 Create Dünyası 2, 3 Nether, 4 End, 5 Lobi, 6 End City — NPC'lerle aynı ışınlamalar.
execute if score @s isinlan matches 1 run function marsana_lobby:npc/click_create
execute if score @s isinlan matches 2 run function marsana_lobby:npc/click_duz
execute if score @s isinlan matches 3 run function marsana_lobby:npc/click_nether
execute if score @s isinlan matches 4 run function marsana_lobby:npc/click_end
execute if score @s isinlan matches 5 run function marsana_lobby:npc/click_donus
execute if score @s isinlan matches 6 run function marsana_lobby:npc/click_endcity
scoreboard players reset @s isinlan
