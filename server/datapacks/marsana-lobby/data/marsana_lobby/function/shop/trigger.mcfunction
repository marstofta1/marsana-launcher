# /trigger magaza set 1 → komut bloğu, set 2 → bariyer, set 3 → Moderatör rankı.
execute if score @s magaza matches 1 run function marsana_lobby:shop/buy_command_block
execute if score @s magaza matches 2 run function marsana_lobby:shop/buy_barrier
execute if score @s magaza matches 3 run function marsana_lobby:shop/buy_mod_rank
scoreboard players reset @s magaza
