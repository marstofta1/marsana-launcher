# Lobideki oyuncu: blok kırıp koyamaz (macera modu), hasar almaz, acıkmaz.
# Yalnızca survival oyuncular değiştirilir; yaratıcı/izleyici moddaki yöneticilere dokunulmaz.
execute if entity @s[gamemode=survival] run function marsana_lobby:enter
effect give @s minecraft:resistance 3 4 true
effect give @s minecraft:fire_resistance 3 0 true
effect give @s minecraft:saturation 3 0 true
