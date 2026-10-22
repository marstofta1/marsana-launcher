# Kullanım (op): /function marsana_lobby:npc/endcity_ayarla {x:-576,z:-928}
# End City NPC'sinin ışınladığı yer. Koordinat için konsolda:
# execute in minecraft:the_end run locate structure minecraft:end_city
$data modify storage marsana_lobby:ayar endcity set value {x:$(x),z:$(z)}
$tellraw @s {"text":"[Klima] End City NPC'si artık $(x) $(z) çevresine ışınlıyor.","color":"green"}
