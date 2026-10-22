# Tam olarak bir tane yoksa (atıldı, sandığa kondu, öldü, creative'de çoğaltıldı) hepsi silinir ve bir tane verilir.
execute store result score @s marsana_lobby.calc run clear @s minecraft:painting[minecraft:custom_data={marsana_menu:1b}] 0
execute if score @s marsana_lobby.calc matches 1 run return 0
clear @s minecraft:painting[minecraft:custom_data={marsana_menu:1b}]
give @s minecraft:painting[minecraft:custom_data={marsana_menu:1b},minecraft:custom_name='{"text":"Işınlanma Menüsü","color":"aqua","bold":true,"italic":false}',minecraft:lore=['{"text":"Sağ tıkla: Create Dünyası, Create Dünyası 2, Nether, End","color":"gray","italic":false}'],minecraft:enchantment_glint_override=true]
