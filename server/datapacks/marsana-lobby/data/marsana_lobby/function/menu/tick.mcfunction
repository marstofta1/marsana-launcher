# Işınlanma Menüsü eşyası (tablo görünümlü, custom_data marsana_menu): herkesin envanterinde tek bir tane durur.
# Atılan kopyası silinir ve envantere geri verilir; sol eldeyse alınır (sol elle duvara tablo asılmasın).
kill @e[type=minecraft:item,nbt={Item:{components:{"minecraft:custom_data":{marsana_menu:1b}}}}]
execute as @a[predicate=marsana_lobby:menu_sol] run item replace entity @s weapon.offhand with minecraft:air
execute as @a[tag=!marsana_lobby.pending] run function marsana_lobby:menu/check
# Sağ tık: eşyayı tutan oyuncunun gözünün 0,6 blok önünde görünmez bir tıklama kutusu (interaction) durur;
# sağ tık bloğa/havaya değil kutuya gider, advancement/menu.json menüyü açar. Kutu claim kutusu gibi oyuncuya bağlıdır.
tag @e[type=minecraft:interaction,tag=marsana_lobby.menubox] add marsana_lobby.menustale
execute as @a[predicate=marsana_lobby:menu_el,gamemode=!spectator] at @s anchored eyes positioned ^ ^ ^0.6 run function marsana_lobby:menu/box
kill @e[type=minecraft:interaction,tag=marsana_lobby.menustale]
# Kutu hızlı harekette geride kalırsa eşya duvara tablo olarak asılabilir: o tablo silinir, menü yine açılır.
execute as @a[scores={marsana_lobby.tablo=1..}] at @s run function marsana_lobby:menu/placed
tag @e[type=minecraft:painting,tag=!marsana_lobby.tablo_eski] add marsana_lobby.tablo_eski
scoreboard players remove @a[scores={marsana_lobby.menucd=1..}] marsana_lobby.menucd 1
