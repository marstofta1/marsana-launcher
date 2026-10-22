advancement revoke @s only marsana_lobby:npc/end
# End lobisine ışınlar: ana adanın ortasındaki binada (0 62 -4), güneye (ortadaki çukura) bakarak.
function marsana_lobby:save_pos
execute in minecraft:the_end run tp @s 0.5 62 -3.5 0 0
tellraw @s {"text":"[Klima] End lobisine ışınlandın.","color":"dark_purple"}
