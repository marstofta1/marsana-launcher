advancement revoke @s only marsana_lobby:npc/endcity
# Kayıtlı End City'nin (storage marsana_lobby:ayar endcity, varsayılanı load'da) 10 blok çevresinde en üstteki güvenli bloğa.
# Datapack /locate sonucunu okuyamaz; başka bir şehir için op: /function marsana_lobby:npc/endcity_ayarla {x:..,z:..}
function marsana_lobby:save_pos
execute store success score #ok marsana_lobby.calc run function marsana_lobby:npc/tp_endcity with storage marsana_lobby:ayar endcity
execute if score #ok marsana_lobby.calc matches 0 run return run tellraw @s {"text":"[Klima] End City'de güvenli bir yer bulunamadı, tekrar dene.","color":"red"}
tellraw @s {"text":"[Klima] End City'ye ışınlandın. Lobiye dönmek için: /trigger lobi","color":"light_purple"}
