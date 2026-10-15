advancement revoke @s only marsana_lobby:npc/trash
# Elde tutulan eşya (tüm yığın) silinir. Yakına atılan eşyaları mobs.mcfunction siler.
execute unless data entity @s SelectedItem run return run tellraw @s {"text":"[Çöp] Silmek istediğin eşyayı elinde tutup tıkla ya da yanıma at.","color":"gray"}
execute store result score #trash marsana_lobby.calc run data get entity @s SelectedItem.count
item replace entity @s weapon.mainhand with minecraft:air
tellraw @s ["",{"text":"[Çöp] ","color":"gray"},{"score":{"name":"#trash","objective":"marsana_lobby.calc"},"color":"white"},{"text":" eşya çöpe atıldı.","color":"gray"}]
