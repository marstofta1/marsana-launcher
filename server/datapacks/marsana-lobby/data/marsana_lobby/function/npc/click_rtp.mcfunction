advancement revoke @s only marsana_lobby:npc/rtp
# Create Dünyası NPC'sinden farklı: kayıtlı konuma değil, her tıklamada Create dünyasında (overworld) yeni bir rastgele noktaya.
# 0 0 çevresinde 5000 blok içinde; spreadplayers su, lav ve ateş üstüne koymaz. Daha uzak noktalar sunucuyu kasar.
function marsana_lobby:save_pos
execute store success score #ok marsana_lobby.calc in minecraft:overworld run spreadplayers 0 0 0 5000 false @s
execute if score #ok marsana_lobby.calc matches 0 run return run tellraw @s {"text":"[Klima] Güvenli bir yer bulunamadı, tekrar dene.","color":"red"}
tellraw @s {"text":"[Klima] Dünyada rastgele bir yere ışınlandın. Lobiye dönmek için: /trigger lobi","color":"green"}
