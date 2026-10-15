# /trigger ayarlar set 1 → girişte lobiye ışınlanma, set 2 → lobi bildirimleri (aç/kapa).
execute if score @s ayarlar matches 1 run function marsana_lobby:npc/toggle_autolobby
execute if score @s ayarlar matches 2 run function marsana_lobby:npc/toggle_notify
scoreboard players reset @s ayarlar
function marsana_lobby:npc/settings_menu
