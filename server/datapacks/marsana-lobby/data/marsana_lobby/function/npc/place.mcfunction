# NPC: hareketsiz, hasar almayan köylü + tıklamayı yakalayan görünmez etkileşim kutusu.
# Tıklama advancement/npc/<kind>.json ile algılanır.
$summon minecraft:villager ~ ~ ~ {NoAI:1b,Invulnerable:1b,Silent:1b,PersistenceRequired:1b,CanPickUpLoot:0b,Tags:["marsana_lobby.npc","marsana_lobby.npc_new"],CustomName:'{"text":"$(name)","color":"$(color)","bold":true}',CustomNameVisible:1b,VillagerData:{profession:"$(prof)",level:5,type:"minecraft:plains"},Offers:{Recipes:[]}}
$summon minecraft:interaction ~ ~ ~ {width:0.9f,height:2.1f,response:1b,Tags:["marsana_lobby.npc","marsana_lobby.npc_new","marsana_lobby.npc_$(kind)"]}
tp @e[type=minecraft:villager,tag=marsana_lobby.npc_new] ~ ~ ~ ~ 0
tag @e[tag=marsana_lobby.npc_new] remove marsana_lobby.npc_new
$tellraw @s {"text":"[Klima] $(name) NPC'si yerleştirildi.","color":"green"}
