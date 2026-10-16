# End Crystal patlamaları kapalı: kristal kırılamadan silinir, eşyası yere geri düşer.
summon minecraft:item ~ ~ ~ {Item:{id:"minecraft:end_crystal",count:1},PickupDelay:10s}
tellraw @a[distance=..8] {"text":"End Crystal patlamaları bu sunucuda kapalı.","color":"red"}
kill @s
