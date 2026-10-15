# Lobideki oyuncu: blok kırıp koyamaz (macera modu), hasar almaz, acıkmaz.
# Adminler (marsana.admin etiketi) hariç herkes macera moduna alınır; adminler lobiyi düzenleyebilir.
execute if entity @s[tag=!marsana.admin,gamemode=!adventure] run function marsana_lobby:enter
effect give @s minecraft:resistance 3 4 true
effect give @s minecraft:fire_resistance 3 0 true
effect give @s minecraft:saturation 3 0 true
