advancement revoke @s only marsana_lobby:npc/nether
# Nether'da 0 0 çevresinde 5000 blok içinde rastgele güvenli bir nokta. "under 120": bedrock tavanın (y 127)
# üstüne çıkmaz, 120'nin altındaki ilk zemine (lav/ateş olmayan, üstü 2 blok hava) konur.
# Daha uzak noktalar her tıklamada yeni chunk ürettirir; sunucu kasmasın diye 5000 ile sınırlı.
function marsana_lobby:save_pos
execute store success score #ok marsana_lobby.calc in minecraft:the_nether run spreadplayers 0 0 0 5000 under 120 false @s
execute if score #ok marsana_lobby.calc matches 0 run return run tellraw @s {"text":"[Marsana] Nether'da güvenli bir yer bulunamadı, tekrar dene.","color":"red"}
tellraw @s {"text":"[Marsana] Nether'da rastgele bir yere ışınlandın. Lobiye dönmek için: /trigger lobi","color":"red"}
