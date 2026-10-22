# Işınlanma Menüsü eşyası (Create üretim planı, custom_data marsana_menu): herkesin envanterinde tek bir tane durur.
# Atılan kopyası silinir ve envantere geri verilir; sol eldeyse alınır (sol elle duvara plan asılmasın). Eski sürümün tablo menüsü silinir.
kill @e[type=minecraft:item,nbt={Item:{components:{"minecraft:custom_data":{marsana_menu:1b}}}}]
execute as @a[predicate=marsana_lobby:menu_sol] run item replace entity @s weapon.offhand with minecraft:air
clear @a minecraft:painting[minecraft:custom_data={marsana_menu:1b}]
execute as @a[tag=!marsana_lobby.pending] run function marsana_lobby:menu/check
# Sağ tık: eşyayı tutan oyuncunun gözünün 0,6 blok önünde görünmez bir tıklama kutusu (interaction) durur;
# sağ tık bloğa/havaya değil kutuya gider, advancement/menu.json menüyü açar. Kutu claim kutusu gibi oyuncuya bağlıdır.
tag @e[type=minecraft:interaction,tag=marsana_lobby.menubox] add marsana_lobby.menustale
execute as @a[predicate=marsana_lobby:menu_el,gamemode=!spectator] at @s anchored eyes positioned ^ ^ ^0.6 run function marsana_lobby:menu/box
kill @e[type=minecraft:interaction,tag=marsana_lobby.menustale]
# Kutu hızlı harekette geride kalırsa eşya duvara plan olarak asılabilir: o plan silinir, menü yine açılır.
execute as @a[scores={marsana_lobby.plan=1..}] at @s run function marsana_lobby:menu/placed
tag @e[type=create:crafting_blueprint,tag=!marsana_lobby.plan_eski] add marsana_lobby.plan_eski
scoreboard players remove @a[scores={marsana_lobby.menucd=1..}] marsana_lobby.menucd 1
