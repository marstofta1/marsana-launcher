# Lobiden çıkan oyuncu: admin olmayanlar Create dünyasında creative'e geçer, adminlerin macera modu survival'a döner.
execute if entity @s[tag=!marsana.admin] run gamemode creative @s
execute if entity @s[tag=marsana.admin,gamemode=adventure] run gamemode survival @s
tag @s remove marsana_lobby.adv
execute at @s if dimension minecraft:the_end run return run execute unless entity @s[tag=marsana_lobby.no_notify] run title @s actionbar {"text":"End'e çıktın","color":"dark_purple"}
execute unless entity @s[tag=marsana_lobby.no_notify] run title @s actionbar {"text":"Create dünyasına geçtin","color":"green"}
