# Kullanım (op): kaldırılacak NPC'nin yanında (2 blok içinde) "/function marsana_lobby:npc/remove".
execute store result score #removed marsana_lobby.calc if entity @e[tag=marsana_lobby.npc,distance=..2]
kill @e[tag=marsana_lobby.npc,distance=..2]
tellraw @s ["",{"text":"[Marsana] Kaldırılan NPC parçası: ","color":"yellow"},{"score":{"name":"#removed","objective":"marsana_lobby.calc"},"color":"yellow"}]
